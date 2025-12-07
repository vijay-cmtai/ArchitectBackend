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
 * ✅ PhonePe Standard Checkout - X-VERIFY Checksum Method
 * Production Ready - Works without OAuth
 */
const generatePhonePeChecksum = (base64Payload, endpoint, saltKey, saltIndex) => {
  const stringToHash = base64Payload + endpoint + saltKey;
  const sha256Hash = crypto
    .createHash("sha256")
    .update(stringToHash)
    .digest("hex");
  
  return sha256Hash + "###" + saltIndex;
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

// --- PHONEPE PRODUCTION CONTROLLERS ---

/**
 * ✅ 1. Create PhonePe Payment - PRODUCTION
 * Standard Checkout with X-VERIFY
 */
const createPhonePePayment = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  console.log("🔄 [PhonePe] Initiating payment for order:", order._id);

  const merchantTransactionId = `TXN_${order._id}_${Date.now()}`;
  const amount = Math.round(order.totalPrice * 100);

  let phoneNumber = order.shippingAddress.phone || "9999999999";
  phoneNumber = phoneNumber.replace(/\D/g, "").slice(-10);

  const merchantId = process.env.PHONEPE_MERCHANT_ID;
  const clientSecret = process.env.PHONEPE_CLIENT_SECRET;

  if (!merchantId || !clientSecret) {
    res.status(500);
    throw new Error("PhonePe credentials not configured properly");
  }

  // Payment payload
  const payloadData = {
    merchantId: merchantId,
    merchantTransactionId: merchantTransactionId,
    merchantUserId: order.user ? order.user.toString() : "GUEST_USER",
    amount: amount,
    redirectUrl: `${process.env.FRONTEND_URL}/order/${order._id}`,
    redirectMode: "REDIRECT",
    callbackUrl: `${process.env.BACKEND_URL}/api/orders/phonepe-webhook`,
    mobileNumber: phoneNumber,
    paymentInstrument: {
      type: "PAY_PAGE",
    },
  };

  const base64Payload = Buffer.from(JSON.stringify(payloadData)).toString("base64");
  const endpoint = "/pg/v1/pay";
  const checksum = generatePhonePeChecksum(base64Payload, endpoint, clientSecret, "1");

  console.log("📦 [PhonePe] Merchant ID:", merchantId);
  console.log("📦 [PhonePe] Transaction ID:", merchantTransactionId);
  console.log("💰 [PhonePe] Amount (paise):", amount);

  try {
    // PRODUCTION URL
    const apiUrl = "https://api.phonepe.com/apis/hermes/pg/v1/pay";

    console.log("📍 [PhonePe] API URL:", apiUrl);
    console.log("🚀 [PhonePe] Mode: PRODUCTION");

    const response = await axios.post(
      apiUrl,
      { request: base64Payload },
      {
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": checksum,
        },
        timeout: 15000,
      }
    );

    console.log("✅ [PhonePe] Response:", JSON.stringify(response.data, null, 2));

    if (response.data.success && response.data.data?.instrumentResponse?.redirectInfo?.url) {
      order.merchantTransactionId = merchantTransactionId;
      await order.save();

      res.json({
        success: true,
        redirectUrl: response.data.data.instrumentResponse.redirectInfo.url,
        merchantTransactionId: merchantTransactionId,
      });
    } else {
      console.error("❌ [PhonePe] Payment failed:", response.data);
      res.status(500);
      throw new Error(response.data.message || "PhonePe payment initiation failed");
    }
  } catch (error) {
    console.error("❌ [PhonePe] Error:", error.response?.data || error.message);
    
    let errorMessage = "Payment initiation failed";
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.response?.data?.code) {
      errorMessage = `PhonePe Error: ${error.response.data.code}`;
    }
    
    res.status(500);
    throw new Error(errorMessage);
  }
});

/**
 * ✅ 2. Check Payment Status - PRODUCTION
 */
const checkPhonePePaymentStatus = asyncHandler(async (req, res) => {
  const { merchantTransactionId } = req.params;

  console.log("🔄 [PhonePe] Checking status for:", merchantTransactionId);

  const merchantId = process.env.PHONEPE_MERCHANT_ID;
  const clientSecret = process.env.PHONEPE_CLIENT_SECRET;

  if (!merchantId || !clientSecret) {
    res.status(500);
    throw new Error("PhonePe credentials not configured");
  }

  try {
    const endpoint = `/pg/v1/status/${merchantId}/${merchantTransactionId}`;
    const checksum = generatePhonePeChecksum("", endpoint, clientSecret, "1");

    // PRODUCTION URL
    const statusUrl = `https://api.phonepe.com/apis/hermes${endpoint}`;

    console.log("📍 [PhonePe] Status URL:", statusUrl);

    const response = await axios.get(statusUrl, {
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": checksum,
      },
      timeout: 10000,
    });

    console.log("✅ [PhonePe] Status Response:", JSON.stringify(response.data, null, 2));

    if (response.data.success && response.data.code === "PAYMENT_SUCCESS") {
      // Extract order ID from merchant transaction ID
      const orderIdMatch = merchantTransactionId.match(/TXN_([^_]+)_/);
      const orderId = orderIdMatch ? orderIdMatch[1] : null;

      if (orderId) {
        const order = await Order.findById(orderId);

        if (order && !order.isPaid) {
          await updateOrderAfterPayment(order, {
            id: response.data.data.transactionId,
            method: "PhonePe",
            paymentId: merchantTransactionId,
          });
          console.log(`✅ [PhonePe] Order ${orderId} marked as paid`);

          return res.json({
            success: true,
            message: "Payment Successful",
            code: response.data.code,
            order,
          });
        }
      }
    }

    res.json({
      success: response.data.success,
      code: response.data.code,
      message: response.data.message,
      data: response.data.data,
    });
  } catch (error) {
    console.error("❌ [PhonePe] Status error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Status check failed",
      error: error.response?.data || error.message,
    });
  }
});

/**
 * ✅ 3. Handle PhonePe Webhook - PRODUCTION
 */
const handlePhonePeWebhook = asyncHandler(async (req, res) => {
  console.log("🔔 [PhonePe] Webhook received");
  console.log("📨 [PhonePe] Request body:", JSON.stringify(req.body, null, 2));

  try {
    if (req.body.response) {
      // Decode base64 response
      const decodedBuffer = Buffer.from(req.body.response, "base64");
      const decodedBody = JSON.parse(decodedBuffer.toString("utf8"));

      console.log("📨 [PhonePe] Decoded webhook:", JSON.stringify(decodedBody, null, 2));

      if (decodedBody.code === "PAYMENT_SUCCESS") {
        const merchantTxnId = decodedBody.data.merchantTransactionId;

        // Extract order ID from transaction ID
        const orderIdMatch = merchantTxnId.match(/TXN_([^_]+)_/);
        const orderId = orderIdMatch ? orderIdMatch[1] : null;

        if (orderId) {
          const order = await Order.findById(orderId);

          if (order && !order.isPaid) {
            await updateOrderAfterPayment(order, {
              id: decodedBody.data.transactionId,
              method: "PhonePe Webhook",
              paymentId: merchantTxnId,
            });
            console.log(`✅ [PhonePe] Order ${orderId} updated via webhook`);
          } else if (order && order.isPaid) {
            console.log(`ℹ️ [PhonePe] Order ${orderId} already marked as paid`);
          } else {
            console.error(`❌ [PhonePe] Order ${orderId} not found`);
          }
        }
      } else {
        console.log(`⚠️ [PhonePe] Payment status: ${decodedBody.code}`);
      }
    }
  } catch (err) {
    console.error("❌ [PhonePe] Webhook processing error:", err);
  }

  // Always return 200 to acknowledge webhook
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
