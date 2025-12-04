const asyncHandler = require("express-async-handler");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const Order = require("../models/orderModel.js");
const Product = require("../models/productModel.js");
const ProfessionalPlan = require("../models/professionalPlanModel.js");

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
          productName: product.name || item.name, // Fallback to item name
          fileUrl: fileUrl,
        });
      }
    }
  }
  return files;
};

const updateOrderAfterPayment = async (order) => {
  if (!order || order.isPaid) return order;

  order.isPaid = true;
  order.paidAt = new Date();
  order.downloadableFiles = await getDownloadableFilesForOrder(
    order.orderItems
  );

  return await order.save();
};

// --- CONTROLLERS ---

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

  // Add planFile to orderItems
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
    order.paymentResult = {
      id: razorpay_payment_id,
      status: "COMPLETED",
      update_time: new Date().toISOString(),
      email_address: order.shippingAddress.email,
    };
    const updatedOrder = await updateOrderAfterPayment(order);
    res.json(updatedOrder);
  } else {
    res.status(400);
    throw new Error("Payment verification failed");
  }
});

const getPaypalClientId = asyncHandler(async (req, res) => {
  res.json({ clientId: process.env.PAYPAL_CLIENT_ID });
});

const updateOrderToPaidWithPaypal = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (order) {
    order.paymentResult = {
      id: req.body.id,
      status: req.body.status,
      update_time: req.body.update_time,
      email_address: req.body.payer.email_address,
    };
    const updatedOrder = await updateOrderAfterPayment(order);
    res.json(updatedOrder);
  } else {
    res.status(404);
    throw new Error("Order not found");
  }
});

const createPhonePePayment = asyncHandler(async (req, res) => {
  // Validate environment variables
  if (!process.env.PHONEPE_MERCHANT_ID || !process.env.PHONEPE_SALT_KEY) {
    res.status(500);
    throw new Error("PhonePe payment gateway not configured");
  }

  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  // Generate unique transaction ID (must be unique for each transaction)
  const merchantTransactionId = `HPF${Date.now()}`;
  order.merchantTransactionId = merchantTransactionId;
  await order.save();

  const amountInPaise = Math.round(order.totalPrice * 100);

  // Clean phone number
  let phoneNumber = order.shippingAddress.phone || "9999999999";
  phoneNumber = phoneNumber.replace(/\D/g, "");
  if (phoneNumber.length !== 10) phoneNumber = "9999999999";

  // URLs - For local testing, you MUST use ngrok or deploy to production
  const frontendUrl = process.env.FRONTEND_URL;
  const backendUrl = process.env.BACKEND_URL;

  // Validate URLs are not localhost for production
  if (frontendUrl.includes('localhost') || backendUrl.includes('localhost')) {
    console.warn('⚠️ WARNING: Using localhost URLs with production PhonePe API will fail!');
    console.warn('Please use ngrok or deploy to production server.');
  }

  const payload = {
    merchantId: process.env.PHONEPE_MERCHANT_ID,
    merchantTransactionId,
    merchantUserId: req.user ? `U${req.user._id.toString().slice(-10)}` : `GUEST${Date.now()}`,
    amount: amountInPaise,
    redirectUrl: `${frontendUrl}/order-success/${order.orderId}`,
    redirectMode: "POST",
    callbackUrl: `${backendUrl}/api/orders/phonepe-callback`,
    mobileNumber: phoneNumber,
    paymentInstrument: {
      type: "PAY_PAGE",
    },
  };

  console.log("📱 PhonePe Payment Request:");
  console.log("Merchant ID:", process.env.PHONEPE_MERCHANT_ID);
  console.log("Transaction ID:", merchantTransactionId);
  console.log("Amount:", amountInPaise, "paise (₹", order.totalPrice, ")");
  console.log("Redirect URL:", payload.redirectUrl);
  console.log("Callback URL:", payload.callbackUrl);

  const payloadString = JSON.stringify(payload);
  const base64Payload = Buffer.from(payloadString).toString("base64");

  // Production API uses different endpoint path
  const apiEndpoint = "/pg/v1/pay";
  const stringToHash = base64Payload + apiEndpoint + process.env.PHONEPE_SALT_KEY;
  const sha256 = crypto.createHash("sha256").update(stringToHash).digest("hex");
  const xVerify = sha256 + "###" + process.env.PHONEPE_SALT_INDEX;

  console.log("X-VERIFY:", xVerify.substring(0, 20) + "...");

  const apiUrl = `${process.env.PHONEPE_API_URL}${apiEndpoint}`;
  console.log("API URL:", apiUrl);

  const options = {
    method: "POST",
    url: apiUrl,
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      "X-VERIFY": xVerify,
    },
    data: {
      request: base64Payload,
    },
  };

  try {
    const response = await axios.request(options);
    console.log("✅ PhonePe Response:", JSON.stringify(response.data, null, 2));

    if (response.data && response.data.success) {
      const redirectUrl =
        response.data.data?.instrumentResponse?.redirectInfo?.url;
      if (redirectUrl) {
        console.log("🔗 Payment URL:", redirectUrl);
        res.json({ redirectUrl });
      } else {
        console.error("❌ No redirect URL in response");
        res.status(500).json({
          message: "PhonePe did not return a redirect URL",
          details: response.data,
        });
      }
    } else {
      console.error("❌ PhonePe request failed:", response.data);
      res.status(500).json({
        message: response.data.message || "PhonePe payment creation failed",
        code: response.data.code,
        details: response.data,
      });
    }
  } catch (error) {
    console.error("❌ PhonePe API Error:");
    console.error("Status:", error.response?.status);
    console.error("Data:", error.response?.data);
    console.error("Message:", error.message);
    
    res.status(500).json({
      message: "Failed to create PhonePe payment",
      error: error.response?.data || { message: error.message },
    });
  }
});

const handlePhonePeCallback = asyncHandler(async (req, res) => {
  const { response: base64Response } = req.body;
  if (!base64Response)
    return res.status(400).send({ message: "Invalid callback data" });

  const saltKey = process.env.PHONEPE_SALT_KEY;
  const saltIndex = process.env.PHONEPE_SALT_INDEX;
  const receivedHeader = req.headers["x-verify"];
  const calculatedSignature =
    crypto
      .createHash("sha256")
      .update(base64Response + saltKey)
      .digest("hex") +
    "###" +
    saltIndex;

  if (calculatedSignature !== receivedHeader) {
    return res.status(400).send({ message: "Checksum Mismatch" });
  }

  const decodedResponse = JSON.parse(
    Buffer.from(base64Response, "base64").toString()
  );
  const { merchantTransactionId, code } = decodedResponse.data;
  const order = await Order.findOne({ merchantTransactionId });

  if (!order) return res.status(404).send({ message: "Order not found" });
  if (order.isPaid)
    return res.status(200).send({ message: "Order already processed" });

  if (code === "PAYMENT_SUCCESS") {
    order.paymentResult = {
      id: decodedResponse.data.transactionId,
      status: "COMPLETED",
      update_time: new Date().toISOString(),
      email_address: order.shippingAddress.email,
    };
    await updateOrderAfterPayment(order);
  }
  res.status(200).send({ message: "Callback received successfully" });
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

  // Add planFile to orderItems
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
    order.paymentResult = {
      id: `admin-${req.user._id}-${Date.now()}`,
      status: "COMPLETED_BY_ADMIN",
      update_time: new Date().toISOString(),
      email_address: order.shippingAddress.email,
    };
    const updatedOrder = await updateOrderAfterPayment(order);
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
  handlePhonePeCallback,
  getAllOrders,
  updateOrderToPaidByAdmin,
  deleteOrder,
};
