const asyncHandler = require("express-async-handler");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const axios = require("axios");
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
 * ✅ PhonePe V2 - Fetch Auth Token (OAuth 2.0)
 * Documentation: https://developer.phonepe.com/v1/reference/authorization-standard-checkout
 * 
 * IMPORTANT: PhonePe V2 OAuth might not be enabled for all merchants yet.
 * If getting 404, contact PhonePe support to enable V2 API access.
 */
const getPhonePeAuthToken = async () => {
  // Try UAT first, then Production
  const isUAT = process.env.PHONEPE_ENV === "uat" || process.env.PHONEPE_ENV === "sandbox";
  
  // PhonePe V2 OAuth endpoint (as per latest docs)
  const tokenUrl = isUAT 
    ? "https://api-preprod.phonepe.com/v1/oauth/token"
    : "https://api.phonepe.com/v1/oauth/token";

  const clientId = process.env.PHONEPE_CLIENT_ID?.trim();
  const clientSecret = process.env.PHONEPE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error("PhonePe V2 credentials missing in environment variables");
  }

  console.log("🔄 [PhonePe V2] Fetching Auth Token...");
  console.log("📍 URL:", tokenUrl);
  console.log("🔑 Client ID:", clientId);
  console.log("🌍 Mode:", isUAT ? "UAT/SANDBOX" : "PRODUCTION");

  try {
    const response = await axios.post(
      tokenUrl,
      {
        client_id: clientId,
        client_version: 1,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000, // 10 second timeout
      }
    );

    if (response.data && response.data.access_token) {
      console.log("✅ [PhonePe V2] Auth Token received");
      console.log("⏰ Token expires in:", response.data.expires_in, "seconds");
      return response.data.access_token;
    } else {
      throw new Error("No access token in response");
    }

  } catch (error) {
    console.error("❌ [PhonePe V2] Auth Failed");
    
    let errorMessage = "Failed to authenticate with PhonePe V2";
    
    if (error.response) {
      console.error("⚠️ Status:", error.response.status);
      console.error("⚠️ Response:", JSON.stringify(error.response.data, null, 2));
      console.error("⚠️ Headers:", JSON.stringify(error.response.headers, null, 2));
      
      if (error.response.status === 404) {
        errorMessage = `PhonePe 404 NOT FOUND - V2 OAuth API not enabled for your account. Please contact PhonePe support to enable V2 API access. Try setting PHONEPE_ENV=uat to test UAT sandbox first.`;
      } else if (error.response.status === 401) {
        errorMessage = `PhonePe 401 UNAUTHORIZED - Invalid Client ID/Secret. Double check your credentials.`;
      } else if (error.response.status === 403) {
        errorMessage = `PhonePe 403 FORBIDDEN - IP not whitelisted or access denied`;
      } else if (error.response.status === 400) {
        errorMessage = `PhonePe 400 BAD REQUEST - ${JSON.stringify(error.response.data)}`;
      } else {
        errorMessage = `PhonePe Auth Error (${error.response.status}): ${JSON.stringify(error.response.data)}`;
      }
    } else if (error.request) {
      console.error("⚠️ No Response from PhonePe");
      errorMessage = "Network Error - Could not reach PhonePe server";
    } else {
      console.error("⚠️ Error:", error.message);
      errorMessage = error.message;
    }

    throw new Error(errorMessage);
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

// --- PHONEPE V2 CONTROLLERS (Standard Checkout) ---

/**
 * ✅ 1. Initiate Payment (V2)
 * Documentation: https://developer.phonepe.com/v1/reference/initiate-payment-standard-checkout
 */
const createPhonePePayment = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  console.log("🔄 [PhonePe V2] Creating payment for order:", order._id);

  // 1. Get Auth Token
  const accessToken = await getPhonePeAuthToken();

  // 2. Prepare Payment Data
  const merchantTransactionId = order._id.toString();
  const amount = Math.round(order.totalPrice * 100); // Amount in paise

  let phoneNumber = order.shippingAddress.phone || "9999999999";
  phoneNumber = phoneNumber.replace(/\D/g, "").slice(-10);

  // UAT vs Production URL
  const isUAT = process.env.PHONEPE_ENV === "uat" || process.env.PHONEPE_ENV === "sandbox";
  const payUrl = isUAT
    ? "https://api-preprod.phonepe.com/apis/pg-sandbox/v2/debit"
    : "https://api.phonepe.com/apis/hermes/v2/debit";

  const payloadData = {
    merchantId: process.env.PHONEPE_MERCHANT_ID,
    transactionId: merchantTransactionId,
    merchantOrderId: merchantTransactionId,
    amount: amount,
    expiresIn: 180, // 3 minutes
    message: `Order Payment - ${order._id}`,
    mobileNumber: phoneNumber,
    email: order.shippingAddress.email || "customer@example.com",
    storeId: "store1",
    terminalId: "terminal1",
    subMerchant: "HOUSEPLAN",
    redirectUrl: `${process.env.FRONTEND_URL}/order/${order._id}`,
    redirectMode: "REDIRECT",
    callbackUrl: `${process.env.BACKEND_URL}/api/orders/phonepe-webhook`,
    shortName: order.user ? "User" : "Guest",
  };

  console.log("📦 [PhonePe V2] Payload:", {
    merchantId: payloadData.merchantId,
    amount: payloadData.amount,
    transactionId: payloadData.transactionId,
  });

  try {
    console.log("📍 [PhonePe V2] Calling:", payUrl);

    const response = await axios.post(payUrl, payloadData, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    console.log("✅ [PhonePe V2] API Response:", response.data);

    if (response.data && response.data.instrumentResponse) {
      order.merchantTransactionId = merchantTransactionId;
      await order.save();

      res.json({
        redirectUrl: response.data.instrumentResponse.redirectInfo.url,
        merchantTransactionId: merchantTransactionId,
      });
    } else {
      console.error("❌ [PhonePe V2] Payment Creation Failed:", response.data);
      res.status(500);
      throw new Error(response.data.message || "PhonePe initiation failed");
    }
  } catch (error) {
    console.error(
      "❌ [PhonePe V2] API Error:",
      error.response ? JSON.stringify(error.response.data, null, 2) : error.message
    );
    res.status(500);
    throw new Error(
      error.response?.data?.message || "Payment initiation failed"
    );
  }
});

/**
 * ✅ 2. Check Order Status (V2)
 * Documentation: https://developer.phonepe.com/v1/reference/order-status-standard-checkout
 */
const checkPhonePePaymentStatus = asyncHandler(async (req, res) => {
  const { merchantTransactionId } = req.params;

  console.log("🔄 [PhonePe V2] Checking status for:", merchantTransactionId);

  try {
    const accessToken = await getPhonePeAuthToken();

    // UAT vs Production URL
    const isUAT = process.env.PHONEPE_ENV === "uat" || process.env.PHONEPE_ENV === "sandbox";
    const statusUrl = isUAT
      ? `https://api-preprod.phonepe.com/apis/pg-sandbox/v2/status/${process.env.PHONEPE_MERCHANT_ID}/${merchantTransactionId}`
      : `https://api.phonepe.com/apis/hermes/v2/status/${process.env.PHONEPE_MERCHANT_ID}/${merchantTransactionId}`;

    console.log("📍 [PhonePe V2] Status URL:", statusUrl);

    const response = await axios.get(statusUrl, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    console.log("✅ [PhonePe V2] Status Response:", response.data);

    // Check if payment was successful
    if (response.data && response.data.transactionStatus === "SUCCESS") {
      const order = await Order.findById(merchantTransactionId);

      if (order && !order.isPaid) {
        await updateOrderAfterPayment(order, {
          id: response.data.transactionId || merchantTransactionId,
          method: "PhonePe V2",
        });
        console.log(`✅ [PhonePe V2] Order ${merchantTransactionId} marked as paid`);
        
        return res.json({
          success: true,
          message: "Payment Successful",
          order,
        });
      }
    }

    res.json(response.data);
  } catch (error) {
    console.error(
      "❌ [PhonePe V2] Status Check Error:",
      error.response ? JSON.stringify(error.response.data, null, 2) : error.message
    );
    res.status(500).json({ 
      message: "Status check failed",
      error: error.response?.data || error.message 
    });
  }
});

/**
 * ✅ 3. Handle Webhook (V2)
 * Documentation: https://developer.phonepe.com/v1/reference/handling-webhooks-standard-checkout
 */
const handlePhonePeWebhook = asyncHandler(async (req, res) => {
  console.log("🔔 [PhonePe V2] Webhook received");
  console.log("📨 [PhonePe V2] Webhook body:", JSON.stringify(req.body, null, 2));

  try {
    const webhookData = req.body;

    // V2 webhook sends direct JSON
    if (webhookData && webhookData.transactionStatus === "SUCCESS") {
      const orderId = webhookData.transactionId || webhookData.merchantOrderId;
      
      if (!orderId) {
        console.error("❌ [PhonePe V2] Transaction ID missing in webhook");
        return res.status(200).send("OK");
      }

      const order = await Order.findById(orderId);

      if (order && !order.isPaid) {
        await updateOrderAfterPayment(order, {
          id: webhookData.transactionId,
          method: "PhonePe V2 Webhook",
        });
        console.log(`✅ [PhonePe V2] Order ${orderId} updated via webhook`);
      }
    }
  } catch (err) {
    console.error("❌ [PhonePe V2] Webhook processing error:", err);
  }

  // Always respond with 200
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
