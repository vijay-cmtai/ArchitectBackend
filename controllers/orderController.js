const asyncHandler = require("express-async-handler");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const axios = require("axios");
const Order = require("../models/orderModel.js");
const Product = require("../models/productModel.js");
const ProfessionalPlan = require("../models/professionalPlanModel.js");

// Helper: Trim environment variables to prevent "Api Mapping" errors
const getEnv = (key) => (process.env[key] ? process.env[key].trim() : "");

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

const getPhonePeAuthToken = async () => {
  // Use "api.phonepe.com" for PROD. Use "api-preprod.phonepe.com" if Testing.
  const tokenUrl = "https://api.phonepe.com/apis/hermes/v1/oauth/token";

  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("client_id", getEnv("PHONEPE_CLIENT_ID"));
  params.append("client_secret", getEnv("PHONEPE_CLIENT_SECRET"));

  const config = {
    headers: { 
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json"
    },
  };

  try {
    const response = await axios.post(tokenUrl, params.toString(), config);
    return response.data.access_token;
  } catch (error) {
    console.error("Auth Token Error:", error.response?.data);
    throw new Error(error.response?.data?.message || "PhonePe Auth Failed");
  }
};

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
      const profPlan = await ProfessionalPlan.findById(item.productId).select("user");
      if (profPlan) {
        productOwner = profPlan.user;
      } else {
        const adminProduct = await Product.findById(item.productId).select("user");
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

const razorpay = new Razorpay({
  key_id: getEnv("RAZORPAY_KEY_ID"),
  key_secret: getEnv("RAZORPAY_KEY_SECRET"),
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
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }
  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", getEnv("RAZORPAY_KEY_SECRET"))
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

const getPaypalClientId = asyncHandler(async (req, res) => {
  res.json({ clientId: getEnv("PAYPAL_CLIENT_ID") });
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

const createPhonePePayment = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  try {
    const accessToken = await getPhonePeAuthToken();

    const merchantTransactionId = `TXN${Date.now()}`;
    const amount = Math.round(order.totalPrice * 100);

    let phoneNumber = order.shippingAddress?.phone || "9999999999";
    phoneNumber = phoneNumber.replace(/\D/g, "").slice(-10);

    const payloadData = {
      merchantId: getEnv("PHONEPE_MERCHANT_ID"),
      merchantTransactionId: merchantTransactionId,
      merchantUserId: order.user ? order.user.toString() : `GUEST${Date.now()}`,
      amount: amount,
      redirectUrl: `${getEnv("FRONTEND_URL")}/order/${order._id}`,
      redirectMode: "REDIRECT",
      callbackUrl: `${getEnv("BACKEND_URL")}/api/orders/phonepe-webhook`,
      mobileNumber: phoneNumber,
      paymentInstrument: {
        type: "PAY_PAGE"
      }
    };

    const base64Payload = Buffer.from(JSON.stringify(payloadData)).toString("base64");
    
    // Ensure this URL is correct. Use 'hermes' for Live.
    const payUrl = `https://api.phonepe.com/apis/hermes/pg/v1/pay`;

    const config = {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "X-MERCHANT-ID": getEnv("PHONEPE_MERCHANT_ID"),
        "Accept": "application/json"
      },
    };

    const response = await axios.post(
      payUrl,
      { request: base64Payload },
      config
    );

    if (response.data.success) {
      order.paymentResult = {
        ...order.paymentResult,
        id: merchantTransactionId,
        status: "PENDING"
      };
      await order.save();

      return res.json({
        success: true,
        redirectUrl: response.data.data.instrumentResponse.redirectInfo.url,
        merchantTransactionId: merchantTransactionId,
        message: "Payment initiated successfully"
      });
    } else {
      throw new Error(response.data.message || "Payment initiation failed");
    }
  } catch (error) {
    console.error("PhonePe Payment Error Details:", error.response?.data);
    res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.message || "Api Mapping Failed: Check Merchant ID or Go-Live Status",
      details: error.response?.data
    });
  }
});

const checkPhonePePaymentStatus = asyncHandler(async (req, res) => {
  const { merchantTransactionId } = req.params;

  try {
    const accessToken = await getPhonePeAuthToken();
    const statusUrl = `https://api.phonepe.com/apis/hermes/pg/v1/status/${getEnv("PHONEPE_MERCHANT_ID")}/${merchantTransactionId}`;

    const config = {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "X-MERCHANT-ID": getEnv("PHONEPE_MERCHANT_ID"),
        "Accept": "application/json"
      },
    };

    const response = await axios.get(statusUrl, config);

    if (response.data.success && response.data.code === "PAYMENT_SUCCESS") {
      const order = await Order.findOne({ "paymentResult.id": merchantTransactionId });

      if (order && !order.isPaid) {
        await updateOrderAfterPayment(order, {
          id: response.data.data.transactionId,
          method: "PhonePe",
        });

        return res.json({
          success: true,
          message: "Payment verified successfully",
          order: order
        });
      }
    }
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      message: "Status check failed",
      details: error.response?.data
    });
  }
});

const handlePhonePeWebhook = asyncHandler(async (req, res) => {
  try {
    if (req.body.response) {
      const decodedData = JSON.parse(
        Buffer.from(req.body.response, "base64").toString("utf8")
      );

      if (decodedData.code === "PAYMENT_SUCCESS") {
        const merchantTransactionId = decodedData.data.merchantTransactionId;
        const order = await Order.findOne({ "paymentResult.id": merchantTransactionId });
        
        if (order && !order.isPaid) {
          await updateOrderAfterPayment(order, {
            id: decodedData.data.transactionId,
            method: "PhonePe Webhook",
          });
        }
      }
    }
  } catch (error) {
    console.error("Webhook Error:", error);
  }
  res.status(200).send("OK");
});

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
