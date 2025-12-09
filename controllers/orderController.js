const asyncHandler = require("express-async-handler");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const axios = require("axios");
const { HttpsProxyAgent } = require("https-proxy-agent");
const Order = require("../models/orderModel.js");
const Product = require("../models/productModel.js");
const ProfessionalPlan = require("../models/professionalPlanModel.js");

// ============================================
// PROXY CONFIGURATION
// ============================================
const getProxyAgent = () => {
  if (process.env.PHONEPE_PROXY_URL) {
    console.log("🔒 Using Static Proxy:", process.env.PHONEPE_PROXY_URL);
    return new HttpsProxyAgent(process.env.PHONEPE_PROXY_URL);
  }
  return null;
};

// ============================================
// HELPER FUNCTIONS
// ============================================
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

// ============================================
// PHONEPE V2 - OAUTH TOKEN
// ============================================
const getPhonePeAuthToken = async () => {
  const tokenUrl = "https://api.phonepe.com/apis/hermes/v1/oauth/token";

  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("client_id", process.env.PHONEPE_CLIENT_ID);
  params.append("client_secret", process.env.PHONEPE_CLIENT_SECRET);

  const config = {
    headers: { 
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json"
    },
  };

  const agent = getProxyAgent();
  if (agent) config.httpsAgent = agent;

  try {
    console.log("🔐 Requesting PhonePe OAuth Token...");
    const response = await axios.post(tokenUrl, params.toString(), config);
    
    if (response.data && response.data.access_token) {
      console.log("✅ Token Received Successfully");
      return response.data.access_token;
    } else {
      throw new Error("No access token in response");
    }
  } catch (error) {
    console.error("❌ PhonePe Auth Failed:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    if (error.response?.status === 403) {
      throw new Error("IP_BLOCKED: Whitelist your IP on PhonePe Dashboard");
    }
    if (error.response?.status === 401) {
      throw new Error("INVALID_CREDENTIALS: Check Client ID/Secret");
    }
    throw new Error(error.response?.data?.message || "Auth Failed");
  }
};

// ============================================
// ORDER CONTROLLERS
// ============================================

/**
 * @desc    Create new order
 * @route   POST /api/orders
 * @access  Public/Protected
 */
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

/**
 * @desc    Get logged in user orders
 * @route   GET /api/orders/myorders
 * @access  Private
 */
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

/**
 * @desc    Get order by ID for guest users
 * @route   GET /api/orders/guest/:orderId
 * @access  Public
 */
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

// ============================================
// RAZORPAY PAYMENT GATEWAY
// ============================================

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * @desc    Create Razorpay order
 * @route   POST /api/orders/:id/create-razorpay-order
 * @access  Public/Protected
 */
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

/**
 * @desc    Verify Razorpay payment and update order
 * @route   POST /api/orders/:id/verify-payment
 * @access  Public/Protected
 */
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

// ============================================
// PAYPAL PAYMENT GATEWAY
// ============================================

/**
 * @desc    Get PayPal client ID
 * @route   GET /api/orders/paypal/client-id
 * @access  Public
 */
const getPaypalClientId = asyncHandler(async (req, res) => {
  res.json({ clientId: process.env.PAYPAL_CLIENT_ID });
});

/**
 * @desc    Update order to paid with PayPal
 * @route   PUT /api/orders/:id/pay-with-paypal
 * @access  Public/Protected
 */
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

// ============================================
// PHONEPE V2 PAYMENT GATEWAY
// ============================================

/**
 * @desc    Create PhonePe payment
 * @route   POST /api/orders/:id/create-phonepe-payment
 * @access  Public/Protected
 */
const createPhonePePayment = asyncHandler(async (req, res) => {
  console.log("📱 Creating PhonePe Payment for Order:", req.params.id);

  const order = await Order.findById(req.params.id);
  if (!order) {
    return res.status(404).json({ message: "Order not found" });
  }

  try {
    // 1. Get OAuth Token
    const accessToken = await getPhonePeAuthToken();

    // 2. Prepare Payment Data
    const merchantTransactionId = `TXN${order._id}${Date.now()}`.substring(0, 35); // Max 35 chars
    const amount = Math.round(order.totalPrice * 100); // Convert to paise

    // Clean phone number
    let phoneNumber = order.shippingAddress?.phone || "9999999999";
    phoneNumber = phoneNumber.replace(/\D/g, "").slice(-10);

    // ✅ FIXED: Correct V2 payload structure
    const payloadData = {
      merchantId: process.env.PHONEPE_MERCHANT_ID,
      merchantTransactionId: merchantTransactionId,
      merchantUserId: order.user ? order.user.toString().substring(0, 36) : `GUEST${Date.now()}`,
      amount: amount,
      redirectUrl: `${process.env.FRONTEND_URL}/order/${order._id}`,
      redirectMode: "REDIRECT",
      callbackUrl: `${process.env.BACKEND_URL}/api/orders/phonepe-webhook`,
      mobileNumber: phoneNumber,
      paymentInstrument: {
        type: "PAY_PAGE"
      }
    };

    console.log("📦 Payment Payload:", JSON.stringify(payloadData, null, 2));
    console.log("🔑 Using Merchant ID:", process.env.PHONEPE_MERCHANT_ID);
    console.log("🔐 Token Length:", accessToken.length);

    // 3. Encode Payload
    const base64Payload = Buffer.from(JSON.stringify(payloadData)).toString("base64");

    // ✅ FIXED: Use correct V2 API endpoint with merchant ID in URL
    const payUrl = `https://api.phonepe.com/apis/hermes/pg/v1/pay`;

    const config = {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "X-MERCHANT-ID": process.env.PHONEPE_MERCHANT_ID,
        "Accept": "application/json",
        "X-VERIFY": base64Payload // Some versions require this
      },
    };

    const agent = getProxyAgent();
    if (agent) config.httpsAgent = agent;

    console.log("🚀 API Endpoint:", payUrl);
    console.log("📤 Request Headers:", JSON.stringify(config.headers, null, 2));
    console.log("📤 Request Body:", JSON.stringify({ request: base64Payload }, null, 2));

    const response = await axios.post(
      payUrl,
      { request: base64Payload },
      config
    );

    console.log("📥 PhonePe Response:", JSON.stringify(response.data, null, 2));

    // 5. Handle Response
    if (response.data.success && response.data.data?.instrumentResponse?.redirectInfo?.url) {
      // Save transaction ID
      order.merchantTransactionId = merchantTransactionId;
      order.paymentMethod = "PhonePe";
      await order.save();

      return res.json({
        success: true,
        redirectUrl: response.data.data.instrumentResponse.redirectInfo.url,
        merchantTransactionId: merchantTransactionId,
        message: "Payment initiated successfully"
      });
    } else {
      console.error("❌ Payment Initiation Failed:", response.data);
      throw new Error(response.data.message || "Payment initiation failed");
    }
  } catch (error) {
    console.error("💥 PhonePe Payment Error:", {
      status: error.response?.status,
      statusText: error.response?.statusText,
      headers: error.response?.headers,
      data: error.response?.data,
      message: error.message,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers
      }
    });

    // Detailed error handling
    let errorMessage = "Payment initiation failed";
    let errorDetails = error.response?.data;
    
    if (error.response?.status === 404 || errorDetails?.message?.includes("Api Mapping Not Found")) {
      errorMessage = "MERCHANT_NOT_CONFIGURED: Your Merchant ID might not be activated on PhonePe yet. Contact PhonePe support.";
      errorDetails = {
        hint: "Check if PHONEPE_MERCHANT_ID is correct and activated",
        merchantId: process.env.PHONEPE_MERCHANT_ID,
        originalError: error.response?.data
      };
    } else if (error.response?.status === 401) {
      errorMessage = "Authentication failed. Token might be expired or invalid.";
    } else if (error.response?.status === 403) {
      errorMessage = "Access forbidden. Whitelist your server IP on PhonePe Dashboard.";
    } else if (error.response?.status === 400) {
      errorMessage = "Bad Request: " + (error.response?.data?.message || "Invalid payload");
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    }

    res.status(error.response?.status || 500).json({
      success: false,
      message: errorMessage,
      details: errorDetails
    });
  }
});

/**
 * @desc    Check PhonePe payment status
 * @route   GET /api/orders/phonepe-status/:merchantTransactionId
 * @access  Public/Protected
 */
const checkPhonePePaymentStatus = asyncHandler(async (req, res) => {
  const { merchantTransactionId } = req.params;

  console.log("🔍 Checking Payment Status for:", merchantTransactionId);

  try {
    const accessToken = await getPhonePeAuthToken();

    const statusUrl = `https://api.phonepe.com/apis/hermes/pg/v1/status/${process.env.PHONEPE_MERCHANT_ID}/${merchantTransactionId}`;

    const config = {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "X-MERCHANT-ID": process.env.PHONEPE_MERCHANT_ID,
        "Accept": "application/json"
      },
    };

    const agent = getProxyAgent();
    if (agent) config.httpsAgent = agent;

    const response = await axios.get(statusUrl, config);

    console.log("📊 Status Response:", JSON.stringify(response.data, null, 2));

    // Update order if payment successful
    if (response.data.success && response.data.code === "PAYMENT_SUCCESS") {
      const orderId = merchantTransactionId.split('_')[1]; // Extract order ID from TXN_orderId_timestamp
      const order = await Order.findById(orderId);

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
    console.error("❌ Status Check Failed:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      message: "Status check failed",
      details: error.response?.data || error.message
    });
  }
});

/**
 * @desc    Handle PhonePe webhook
 * @route   POST /api/orders/phonepe-webhook
 * @access  Public (Called by PhonePe)
 */
const handlePhonePeWebhook = asyncHandler(async (req, res) => {
  console.log("🔔 PhonePe Webhook Received:", req.body);

  try {
    if (req.body.response) {
      const decodedData = JSON.parse(
        Buffer.from(req.body.response, "base64").toString("utf8")
      );

      console.log("📦 Decoded Webhook Data:", decodedData);

      if (decodedData.code === "PAYMENT_SUCCESS") {
        const merchantTransactionId = decodedData.data.merchantTransactionId;
        const orderId = merchantTransactionId.split('_')[1];

        const order = await Order.findById(orderId);
        if (order && !order.isPaid) {
          await updateOrderAfterPayment(order, {
            id: decodedData.data.transactionId,
            method: "PhonePe Webhook",
          });
          console.log("✅ Order marked as paid via webhook");
        }
      }
    }
  } catch (error) {
    console.error("❌ Webhook Processing Error:", error);
  }

  // Always return 200 to PhonePe
  res.status(200).send("OK");
});

// ============================================
// ADMIN CONTROLLERS
// ============================================

/**
 * @desc    Get all orders (Admin)
 * @route   GET /api/orders/all
 * @access  Private/Admin
 */
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

/**
 * @desc    Mark order as paid by admin
 * @route   PUT /api/orders/:id/mark-as-paid
 * @access  Private/Admin
 */
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

/**
 * @desc    Delete order (Admin)
 * @route   DELETE /api/orders/:id
 * @access  Private/Admin
 */
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

// ============================================
// EXPORTS
// ============================================

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
