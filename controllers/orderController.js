const asyncHandler = require("express-async-handler");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const axios = require("axios");
const Order = require("../models/orderModel.js");
const Product = require("../models/productModel.js");
const ProfessionalPlan = require("../models/professionalPlanModel.js");

// --- PHONEPE V2 HELPER FUNCTIONS ---

/**
 * Get PhonePe Access Token using Client Credentials
 * This token is required for all PhonePe API calls
 */
const getPhonePeAccessToken = async () => {
  const clientId = process.env.PHONEPE_CLIENT_ID;
  const clientSecret = process.env.PHONEPE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error("PhonePe Client ID or Secret not configured");
  }

  try {
    const tokenUrl = `${process.env.PHONEPE_API_URL}/v1/oauth/token`;
    
    const response = await axios.post(
      tokenUrl,
      {
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ PhonePe Access Token received");
    return response.data.access_token;
  } catch (error) {
    console.error("❌ Failed to get PhonePe access token:", error.response?.data);
    throw new Error("Failed to authenticate with PhonePe");
  }
};

/**
 * Generate X-VERIFY header for PhonePe V2 API
 */
const generateXVerify = (payload) => {
  const saltKey = process.env.PHONEPE_SALT_KEY;
  const saltIndex = process.env.PHONEPE_SALT_INDEX;
  
  const stringToHash = payload + saltKey;
  const sha256 = crypto.createHash("sha256").update(stringToHash).digest("hex");
  return sha256 + "###" + saltIndex;
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

// --- PAYPAL CONTROLLERS ---

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

// --- PHONEPE V2 CONTROLLERS ---

/**
 * Create PhonePe Payment (V2 API)
 * Uses OAuth 2.0 authentication
 */
const createPhonePePayment = asyncHandler(async (req, res) => {
  // Validate environment variables
  if (
    !process.env.PHONEPE_MERCHANT_ID ||
    !process.env.PHONEPE_CLIENT_ID ||
    !process.env.PHONEPE_CLIENT_SECRET
  ) {
    res.status(500);
    throw new Error("PhonePe payment gateway not configured properly");
  }

  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  try {
    // Step 1: Get Access Token
    console.log("📱 Getting PhonePe access token...");
    const accessToken = await getPhonePeAccessToken();

    // Step 2: Generate unique transaction ID
    const merchantTransactionId = `TXN${Date.now()}${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    order.merchantTransactionId = merchantTransactionId;
    await order.save();

    const amountInPaise = Math.round(order.totalPrice * 100);

    // Clean phone number
    let phoneNumber = order.shippingAddress.phone || "9999999999";
    phoneNumber = phoneNumber.replace(/\D/g, "");
    if (phoneNumber.length !== 10) phoneNumber = "9999999999";

    const frontendUrl = process.env.FRONTEND_URL;
    const backendUrl = process.env.BACKEND_URL;

    // Step 3: Create payment request payload
    const payload = {
      merchantId: process.env.PHONEPE_MERCHANT_ID,
      merchantTransactionId,
      merchantOrderId: order.orderId,
      amount: amountInPaise,
      currency: "INR",
      redirectUrl: `${frontendUrl}/order-success/${order.orderId}`,
      callbackUrl: `${backendUrl}/api/orders/phonepe-webhook`,
      instrumentType: "PAY_PAGE",
      message: `Payment for Order ${order.orderId}`,
      email: order.shippingAddress.email || "customer@example.com",
      mobile: phoneNumber,
    };

    console.log("📱 PhonePe V2 Payment Request:");
    console.log("Merchant ID:", process.env.PHONEPE_MERCHANT_ID);
    console.log("Transaction ID:", merchantTransactionId);
    console.log("Amount:", amountInPaise, "paise (₹", order.totalPrice, ")");
    console.log("Redirect URL:", payload.redirectUrl);
    console.log("Webhook URL:", payload.callbackUrl);

    // Step 4: Make API call to initiate payment
    const apiUrl = `${process.env.PHONEPE_API_URL}/v1/debit`;
    
    const response = await axios.post(apiUrl, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-MERCHANT-ID": process.env.PHONEPE_MERCHANT_ID,
      },
    });

    console.log("✅ PhonePe Response:", JSON.stringify(response.data, null, 2));

    if (response.data && response.data.success) {
      const redirectUrl = response.data.data?.instrumentResponse?.redirectInfo?.url;
      if (redirectUrl) {
        console.log("🔗 Payment URL:", redirectUrl);
        res.json({ 
          redirectUrl,
          merchantTransactionId,
          orderId: order.orderId
        });
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

/**
 * Handle PhonePe Webhook (V2 API)
 * Receives payment status updates
 */
const handlePhonePeWebhook = asyncHandler(async (req, res) => {
  console.log("🔔 PhonePe Webhook received");
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);

  try {
    const { merchantTransactionId, transactionId, amount, status, code } = req.body;

    if (!merchantTransactionId) {
      return res.status(400).json({ message: "Invalid webhook data" });
    }

    const order = await Order.findOne({ merchantTransactionId });

    if (!order) {
      console.error("❌ Order not found for transaction:", merchantTransactionId);
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.isPaid) {
      console.log("✅ Order already processed");
      return res.status(200).json({ message: "Order already processed" });
    }

    // Check payment status
    if (status === "SUCCESS" || code === "PAYMENT_SUCCESS") {
      console.log("✅ Payment successful for order:", order.orderId);
      
      order.paymentResult = {
        id: transactionId || merchantTransactionId,
        status: "COMPLETED",
        update_time: new Date().toISOString(),
        email_address: order.shippingAddress.email,
      };
      
      await updateOrderAfterPayment(order);
      
      return res.status(200).json({ 
        message: "Payment successful",
        orderId: order.orderId 
      });
    } else if (status === "FAILED" || code === "PAYMENT_ERROR") {
      console.log("❌ Payment failed for order:", order.orderId);
      return res.status(200).json({ message: "Payment failed" });
    } else {
      console.log("⏳ Payment pending for order:", order.orderId);
      return res.status(200).json({ message: "Payment pending" });
    }
  } catch (error) {
    console.error("❌ Webhook processing error:", error);
    return res.status(500).json({ message: "Webhook processing failed" });
  }
});

/**
 * Check PhonePe Payment Status (V2 API)
 * Manual status check if webhook fails
 */
const checkPhonePePaymentStatus = asyncHandler(async (req, res) => {
  const { merchantTransactionId } = req.params;

  if (!merchantTransactionId) {
    res.status(400);
    throw new Error("Transaction ID is required");
  }

  try {
    // Get access token
    const accessToken = await getPhonePeAccessToken();

    // Check payment status
    const statusUrl = `${process.env.PHONEPE_API_URL}/v1/status/${process.env.PHONEPE_MERCHANT_ID}/${merchantTransactionId}`;
    
    const response = await axios.get(statusUrl, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-MERCHANT-ID": process.env.PHONEPE_MERCHANT_ID,
      },
    });

    console.log("📊 Payment Status:", response.data);

    if (response.data && response.data.success) {
      const paymentStatus = response.data.data;
      
      // Update order if payment is successful
      if (paymentStatus.state === "COMPLETED") {
        const order = await Order.findOne({ merchantTransactionId });
        if (order && !order.isPaid) {
          order.paymentResult = {
            id: paymentStatus.transactionId,
            status: "COMPLETED",
            update_time: new Date().toISOString(),
            email_address: order.shippingAddress.email,
          };
          await updateOrderAfterPayment(order);
        }
      }

      res.json(response.data);
    } else {
      res.status(400).json({
        message: "Failed to check payment status",
        details: response.data,
      });
    }
  } catch (error) {
    console.error("❌ Status check error:", error.response?.data);
    res.status(500).json({
      message: "Failed to check payment status",
      error: error.response?.data || { message: error.message },
    });
  }
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
  handlePhonePeWebhook,
  checkPhonePePaymentStatus,
  getAllOrders,
  updateOrderToPaidByAdmin,
  deleteOrder,
};
