const asyncHandler = require("express-async-handler");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const Order = require("../models/orderModel.js");
const Product = require("../models/productModel.js"); // Make sure this path is correct
const mongoose = require("mongoose");

// --- HELPER FUNCTIONS ---

const getDownloadableFilesForOrder = async (orderItems) => {
  const files = [];
  for (const item of orderItems) {
    // Assuming 'Product' is your main model for plans
    const product = await Product.findById(item.productId).select(
      "name planFile"
    );
    if (product && product.planFile && product.planFile.length > 0) {
      files.push({
        productName: product.name,
        fileUrl: product.planFile[0],
      });
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

  const order = new Order({
    user: req.user ? req.user._id : null,
    orderItems: orderItems.map((item) => ({
      ...item,
      productId: item.productId,
    })),
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
    .populate({ path: "orderItems.productId", select: "name planFile" })
    .sort({ createdAt: -1 });
  res.json(orders);
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
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }
  const merchantTransactionId = `M-${order._id}-${Date.now()}`;
  order.merchantTransactionId = merchantTransactionId;
  await order.save();

  const amountInPaise = Math.round(order.totalPrice * 100);
  const payload = {
    merchantId: process.env.PHONEPE_MERCHANT_ID,
    merchantTransactionId,
    merchantUserId: req.user ? req.user._id.toString() : "GUEST",
    amount: amountInPaise,
    redirectUrl: `${process.env.FRONTEND_URL}/order-success/${order.orderId}`,
    redirectMode: "REDIRECT",
    callbackUrl: `${process.env.BACKEND_URL}/api/orders/phonepe-callback`,
    mobileNumber: order.shippingAddress.phone,
    paymentInstrument: { type: "PAY_PAGE" },
  };
  const payloadString = JSON.stringify(payload);
  const base64Payload = Buffer.from(payloadString).toString("base64");
  const stringToHash =
    base64Payload + "/pg/v1/pay" + process.env.PHONEPE_SALT_KEY;
  const sha256 = crypto.createHash("sha256").update(stringToHash).digest("hex");
  const xVerify = sha256 + "###" + process.env.PHONEPE_SALT_INDEX;

  const options = {
    method: "post",
    url: `${process.env.PHONEPE_API_URL}/pg/v1/pay`,
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      "X-VERIFY": xVerify,
    },
    data: { request: base64Payload },
  };
  try {
    const response = await axios.request(options);
    const redirectUrl = response.data.data.instrumentResponse.redirectInfo.url;
    res.json({ redirectUrl });
  } catch (error) {
    console.error(
      "PhonePe Error:",
      error.response ? error.response.data : error.message
    );
    res.status(500).json({ message: "Failed to create PhonePe payment" });
  }
});

const handlePhonePeCallback = asyncHandler(async (req, res) => {
  const payload = req.body;
  const base64Response = payload.response;

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
    console.error("PhonePe callback checksum mismatch.");
    return res.status(400).send({ message: "Checksum Mismatch" });
  }

  const decodedResponse = JSON.parse(
    Buffer.from(base64Response, "base64").toString()
  );
  const { merchantTransactionId, code } = decodedResponse.data;
  const order = await Order.findOne({ merchantTransactionId });

  if (!order) {
    console.error("Order not found for transaction:", merchantTransactionId);
    return res.status(404).send({ message: "Order not found" });
  }
  if (order.isPaid) {
    return res.status(200).send({ message: "Order already processed" });
  }

  if (code === "PAYMENT_SUCCESS") {
    order.paymentResult = {
      id: decodedResponse.data.transactionId,
      status: "COMPLETED",
      update_time: new Date().toISOString(),
      email_address: order.shippingAddress.email,
    };
    await updateOrderAfterPayment(order);
    console.log(`Order ${order.orderId} marked as paid successfully.`);
  } else {
    console.log(`Payment for order ${order.orderId} failed with code: ${code}`);
  }
  res.status(200).send({ message: "Callback received successfully" });
});

const getAllOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({})
    .populate("user", "id name email")
    .sort({ createdAt: -1 });
  res.json(orders);
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
