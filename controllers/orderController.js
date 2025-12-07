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
 * ✅ CORRECTED: PhonePe X-VERIFY Checksum Generator
 * PhonePe uses SHA256 checksum authentication, NOT OAuth
 */
const generatePhonePeChecksum = (payload, endpoint) => {
  const saltKey = process.env.PHONEPE_SALT_KEY;
  const saltIndex = process.env.PHONEPE_SALT_INDEX || "1";
  
  if (!saltKey) {
    throw new Error("PHONEPE_SALT_KEY is not configured");
  }
  
  // Create checksum: SHA256(base64Payload + endpoint + saltKey) + ### + saltIndex
  const stringToHash = payload + endpoint + saltKey;
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

// --- PHONEPE CONTROLLERS (CORRECTED - X-VERIFY METHOD) ---

/**
 * ✅ 1. Create PhonePe Payment (Using X-VERIFY Checksum)
 */
const createPhonePePayment = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  console.log("🔄 [PhonePe] Creating payment for order:", order._id);

  // Prepare Payment Data
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
    paymentInstrument: {
      type: "PAY_PAGE",
    },
  };

  // Encode payload to Base64
  const base64EncodedPayload = Buffer.from(
    JSON.stringify(payloadData),
    "utf8"
  ).toString("base64");

  // Generate X-VERIFY checksum
  const endpoint = "/pg/v1/pay";
  const xVerify = generatePhonePeChecksum(base64EncodedPayload, endpoint);

  console.log("📦 [PhonePe] Payload prepared");
  console.log("🔑 [PhonePe] X-VERIFY generated");

  try {
    const payUrl = "https://api.phonepe.com/apis/hermes/pg/v1/pay";

    const response = await axios.post(
      payUrl,
      {
        request: base64EncodedPayload,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": xVerify,
        },
      }
    );

    console.log("✅ [PhonePe] API Response:", response.data);

    if (response.data.success) {
      order.merchantTransactionId = merchantTransactionId;
      await order.save();

      res.json({
        redirectUrl: response.data.data.instrumentResponse.redirectInfo.url,
        merchantTransactionId: merchantTransactionId,
      });
    } else {
      console.error("❌ [PhonePe] Payment Creation Failed:", response.data);
      res.status(500);
      throw new Error(response.data.message || "PhonePe initiation failed");
    }
  } catch (error) {
    console.error(
      "❌ [PhonePe] API Error:",
      error.response ? error.response.data : error.message
    );
    res.status(500);
    throw new Error(
      error.response?.data?.message || "Payment initiation failed"
    );
  }
});

/**
 * ✅ 2. Check Payment Status (Using X-VERIFY Checksum)
 */
const checkPhonePePaymentStatus = asyncHandler(async (req, res) => {
  const { merchantTransactionId } = req.params;

  console.log("🔄 [PhonePe] Checking status for:", merchantTransactionId);

  try {
    // Generate endpoint and checksum
    const endpoint = `/pg/v1/status/${process.env.PHONEPE_MERCHANT_ID}/${merchantTransactionId}`;
    const xVerify = generatePhonePeChecksum("", endpoint);

    const statusUrl = `https://api.phonepe.com/apis/hermes${endpoint}`;

    const response = await axios.get(statusUrl, {
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": xVerify,
      },
    });

    console.log("✅ [PhonePe] Status Response:", response.data);

    if (response.data.success && response.data.code === "PAYMENT_SUCCESS") {
      const order = await Order.findById(merchantTransactionId);

      if (order && !order.isPaid) {
        await updateOrderAfterPayment(order, {
          id: response.data.data.transactionId,
          method: "PhonePe",
        });
        console.log(`✅ [PhonePe] Order ${merchantTransactionId} marked as paid`);
        
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
      "❌ [PhonePe] Status Check Error:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({ 
      message: "Status check failed",
      error: error.response?.data || error.message 
    });
  }
});

/**
 * ✅ 3. Handle PhonePe Webhook
 */
const handlePhonePeWebhook = asyncHandler(async (req, res) => {
  console.log("🔔 [PhonePe] Webhook received");

  if (req.body.response) {
    try {
      // Decode Base64 response
      const decodedBuffer = Buffer.from(req.body.response, "base64");
      const decodedBody = JSON.parse(decodedBuffer.toString("utf8"));

      console.log("📨 [PhonePe] Webhook Data:", decodedBody);

      if (decodedBody.code === "PAYMENT_SUCCESS") {
        const orderId = decodedBody.data.merchantTransactionId;
        const order = await Order.findById(orderId);

        if (order && !order.isPaid) {
          await updateOrderAfterPayment(order, {
            id: decodedBody.data.transactionId,
            method: "PhonePe Webhook",
          });
          console.log(`✅ [PhonePe] Order ${orderId} updated via webhook`);
        }
      }
    } catch (err) {
      console.error("❌ [PhonePe] Webhook processing error:", err);
    }
  }

  // Always respond with 200 to acknowledge webhook receipt
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
