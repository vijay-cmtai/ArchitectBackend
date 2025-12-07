const asyncHandler = require("express-async-handler");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const axios = require("axios");
const { HttpsProxyAgent } = require("https-proxy-agent"); // ✅ Proxy Agent
const Order = require("../models/orderModel.js");
const Product = require("../models/productModel.js");
const ProfessionalPlan = require("../models/professionalPlanModel.js");

// --- PROXY CONFIGURATION ---
// Vercel se request is Agent ke through jayegi
const getProxyAgent = () => {
  if (process.env.PHONEPE_PROXY_URL) {
    console.log("🔒 Routing traffic through Static Proxy");
    return new HttpsProxyAgent(process.env.PHONEPE_PROXY_URL);
  }
  return null;
};

// --- HELPER FUNCTIONS ---
const getDownloadableFilesForOrder = async (orderItems) => {
  const files = [];
  for (const item of orderItems) {
    let product = await Product.findById(item.productId).select(
      "name planFile Download\\ 1\\ URL"
    );

    if (!product) {
      product = await ProfessionalPlan.findById(item.productId).select(
        "name planFile"
      );
    }

    if (product) {
      const fileUrl =
        (Array.isArray(product.planFile)
          ? product.planFile[0]
          : product.planFile) || product["Download 1 URL"];
      if (fileUrl) {
        files.push({
          productName: product.name || item.name,
          fileUrl: fileUrl,
        });
      }
    }
  }
  return files;
};

const updateOrderAfterPayment = async (order, paymentDetails = {}) => {
  if (!order || order.isPaid) return order;

  order.isPaid = true;
  order.paidAt = new Date();

  order.paymentResult = {
    ...order.paymentResult,
    status: "COMPLETED",
    update_time: new Date().toISOString(),
    ...paymentDetails,
  };

  order.downloadableFiles = await getDownloadableFilesForOrder(
    order.orderItems
  );

  return await order.save();
};

/**
 * ✅ PhonePe OAuth Token (With Proxy)
 */
const getPhonePeAuthToken = async () => {
  const tokenUrl = "https://api.phonepe.com/apis/hermes/v1/oauth/token";

  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("client_id", process.env.PHONEPE_CLIENT_ID);
  params.append("client_secret", process.env.PHONEPE_CLIENT_SECRET);

  const config = {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  };

  // Attach Proxy if exists
  const agent = getProxyAgent();
  if (agent) config.httpsAgent = agent;

  try {
    const response = await axios.post(tokenUrl, params, config);
    console.log("✅ PhonePe Token Received via Proxy");
    return response.data.access_token;
  } catch (error) {
    console.error("❌ PhonePe Auth Failed:");
    if (error.response?.status === 403) {
      throw new Error(
        "PROXY IP BLOCKED: Please whitelist your Proxy IP on PhonePe Dashboard."
      );
    }
    throw new Error(error.response?.data?.message || "PhonePe Auth Failed");
  }
};

// --- STANDARD ORDER CONTROLLERS ---

const addOrderItems = asyncHandler(async (req, res) => {
  const {
    orderItems,
    shippingAddress,
    paymentMethod,
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
  } = req.body;

  if (!orderItems || orderItems.length === 0) {
    res.status(400);
    throw new Error("No order items");
  }

  const processedOrderItems = await Promise.all(
    orderItems.map(async (item) => {
      let productOwner = null;

      const profPlan = await ProfessionalPlan.findById(item.productId).select(
        "user"
      );
      if (profPlan) {
        productOwner = profPlan.user;
      } else {
        const adminProduct = await Product.findById(item.productId).select(
          "user"
        );
        if (adminProduct && adminProduct.user) {
          productOwner = adminProduct.user;
        }
      }

      return {
        ...item,
        productId: item.productId,
        professional: productOwner,
      };
    })
  );

  const order = new Order({
    user: req.user ? req.user._id : null,
    orderItems: processedOrderItems,
    shippingAddress,
    paymentMethod,
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
  });

  const createdOrder = await order.save();
  res.status(201).json(createdOrder);
});

const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
    .populate({
      path: "orderItems.productId",
      select:
        "name planFile mainImage Download\\ 1\\ URL Download\\ 2\\ URL Download\\ 3\\ URL",
    })
    .sort({ createdAt: -1 });

  const ordersWithFiles = orders.map((order) => {
    const orderObj = order.toObject();
    orderObj.orderItems = orderObj.orderItems.map((item) => {
      if (item.productId) {
        return {
          ...item,
          planFile:
            item.productId.planFile ||
            (item.productId["Download 1 URL"]
              ? [item.productId["Download 1 URL"]]
              : []),
          image: item.image || item.productId.mainImage,
        };
      }
      return item;
    });
    return orderObj;
  });

  res.json(ordersWithFiles);
});

const getOrderByIdForGuest = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ orderId: req.params.orderId }).populate(
    "orderItems.productId",
    "name"
  );

  if (order) {
    res.json(order);
  } else {
    res.status(404);
    throw new Error("Order not found");
  }
});

// --- RAZORPAY CONTROLLERS ---

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const createRazorpayOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }
  const options = {
    amount: Math.round(order.totalPrice * 100),
    currency: "INR",
    receipt: order._id.toString(),
  };
  try {
    const razorpayOrder = await razorpay.orders.create(options);
    res.json({
      orderId: razorpayOrder.id,
      currency: razorpayOrder.currency,
      amount: razorpayOrder.amount,
    });
  } catch (error) {
    res.status(500);
    throw new Error("Could not create Razorpay order");
  }
});

const verifyPaymentAndUpdateOrder = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body;
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }
  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest("hex");
  if (expectedSignature === razorpay_signature) {
    const updatedOrder = await updateOrderAfterPayment(order, {
      id: razorpay_payment_id,
      email_address: order.shippingAddress.email,
    });
    res.json(updatedOrder);
  } else {
    res.status(400);
    throw new Error("Payment verification failed");
  }
});

// --- PAYPAL CONTROLLERS ---

const getPaypalClientId = asyncHandler(async (req, res) => {
  res.json({ clientId: process.env.PAYPAL_CLIENT_ID });
});

const updateOrderToPaidWithPaypal = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (order) {
    const updatedOrder = await updateOrderAfterPayment(order, {
      id: req.body.id,
      status: req.body.status,
      email_address: req.body.payer.email_address,
    });
    res.json(updatedOrder);
  } else {
    res.status(404);
    throw new Error("Order not found");
  }
});

// --- PHONEPE V2 CONTROLLERS ---

/**
 * 1. Create Payment (With Proxy)
 */
const createPhonePePayment = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });

  // 1. Get Token
  const accessToken = await getPhonePeAuthToken();

  // 2. Prepare Data
  const merchantTransactionId = order._id.toString();
  const amount = Math.round(order.totalPrice * 100);
  let phoneNumber = order.shippingAddress.phone || "9999999999";
  phoneNumber = phoneNumber.replace(/\D/g, "").slice(-10);

  const payloadData = {
    merchantId: process.env.PHONEPE_MERCHANT_ID,
    merchantTransactionId: merchantTransactionId,
    merchantUserId: order.user ? order.user.toString() : "GUEST",
    amount: amount,
    redirectUrl: `${process.env.FRONTEND_URL}/order/${order._id}`,
    redirectMode: "REDIRECT",
    callbackUrl: `${process.env.BACKEND_URL}/api/orders/phonepe-webhook`,
    mobileNumber: phoneNumber,
    paymentInstrument: { type: "PAY_PAGE" },
  };

  const base64EncodedPayload = Buffer.from(
    JSON.stringify(payloadData)
  ).toString("base64");
  const payUrl = "https://api.phonepe.com/apis/hermes/pg/v1/pay";

  const config = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-MERCHANT-ID": process.env.PHONEPE_MERCHANT_ID,
    },
  };

  // Attach Proxy
  const agent = getProxyAgent();
  if (agent) config.httpsAgent = agent;

  try {
    const response = await axios.post(
      payUrl,
      { request: base64EncodedPayload },
      config
    );

    if (response.data.success) {
      order.merchantTransactionId = merchantTransactionId;
      await order.save();
      res.json({
        redirectUrl: response.data.data.instrumentResponse.redirectInfo.url,
        merchantTransactionId: merchantTransactionId,
      });
    } else {
      res.status(500);
      throw new Error(response.data.message || "Initiation failed");
    }
  } catch (error) {
    console.error(
      "PhonePe Payment Error:",
      error.response?.data || error.message
    );
    res.status(500);
    throw new Error("Payment initiation failed at Gateway");
  }
});

/**
 * 2. Check Status (With Proxy)
 */
const checkPhonePePaymentStatus = asyncHandler(async (req, res) => {
  const { merchantTransactionId } = req.params;

  try {
    const accessToken = await getPhonePeAuthToken();
    const statusUrl = `https://api.phonepe.com/apis/hermes/pg/v1/status/${process.env.PHONEPE_MERCHANT_ID}/${merchantTransactionId}`;

    const config = {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-MERCHANT-ID": process.env.PHONEPE_MERCHANT_ID,
      },
    };

    // Attach Proxy
    const agent = getProxyAgent();
    if (agent) config.httpsAgent = agent;

    const response = await axios.get(statusUrl, config);

    if (response.data.success && response.data.code === "PAYMENT_SUCCESS") {
      const order = await Order.findById(merchantTransactionId);
      if (order && !order.isPaid) {
        await updateOrderAfterPayment(order, {
          id: response.data.data.transactionId,
          method: "PhonePe",
        });
        return res.json({
          success: true,
          message: "Payment Successful",
          order,
        });
      }
    }
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ message: "Status check failed" });
  }
});

/**
 * 3. Handle Webhook (No Proxy needed here as PhonePe calls us)
 */
const handlePhonePeWebhook = asyncHandler(async (req, res) => {
  if (req.body.response) {
    try {
      const decodedBody = JSON.parse(
        Buffer.from(req.body.response, "base64").toString("utf8")
      );
      if (decodedBody.code === "PAYMENT_SUCCESS") {
        const orderId = decodedBody.data.merchantTransactionId;
        const order = await Order.findById(orderId);
        if (order && !order.isPaid) {
          await updateOrderAfterPayment(order, {
            id: decodedBody.data.transactionId,
            method: "PhonePe Webhook",
          });
        }
      }
    } catch (err) {
      console.error("Webhook Error:", err);
    }
  }
  res.status(200).send("OK");
});

// --- ADMIN CONTROLLERS ---

const getAllOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({})
    .populate("user", "id name email")
    .populate({
      path: "orderItems.productId",
      select:
        "name planFile mainImage Download\\ 1\\ URL Download\\ 2\\ URL Download\\ 3\\ URL",
    })
    .sort({ createdAt: -1 });

  const ordersWithFiles = orders.map((order) => {
    const orderObj = order.toObject();
    orderObj.orderItems = orderObj.orderItems.map((item) => {
      if (item.productId) {
        return {
          ...item,
          planFile:
            item.productId.planFile ||
            (item.productId["Download 1 URL"]
              ? [item.productId["Download 1 URL"]]
              : []),
          image: item.image || item.productId.mainImage,
        };
      }
      return item;
    });
    return orderObj;
  });

  res.json(ordersWithFiles);
});

const updateOrderToPaidByAdmin = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (order) {
    const updatedOrder = await updateOrderAfterPayment(order, {
      id: `admin-${req.user._id}-${Date.now()}`,
      status: "COMPLETED_BY_ADMIN",
      email_address: order.shippingAddress.email,
    });
    res.json(updatedOrder);
  } else {
    res.status(404);
    throw new Error("Order not found");
  }
});

const deleteOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (order) {
    await order.deleteOne();
    res.json({ message: "Order removed successfully" });
  } else {
    res.status(404);
    throw new Error("Order not found");
  }
});

module.exports = {
  addOrderItems,
  getMyOrders,
  getOrderByIdForGuest,
  createRazorpayOrder,
  verifyPaymentAndUpdateOrder,
  getPaypalClientId,
  updateOrderToPaidWithPaypal,
  createPhonePePayment,
  checkPhonePePaymentStatus,
  handlePhonePeWebhook,
  getAllOrders,
  updateOrderToPaidByAdmin,
  deleteOrder,
};
