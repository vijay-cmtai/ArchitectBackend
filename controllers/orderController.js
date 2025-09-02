// controllers/orderController.js

const asyncHandler = require("express-async-handler");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const Order = require("../models/orderModel.js");

// --- USER FUNCTIONS ---
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
    user: req.user._id,
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

// --- PAYMENT GATEWAY FUNCTIONS ---
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
    order.isPaid = true;
    order.paidAt = Date.now();
    order.paymentResult = {
      id: razorpay_payment_id,
      status: "COMPLETED",
      update_time: new Date().toISOString(),
      email_address: req.user.email,
    };
    const updatedOrder = await order.save();
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
    order.isPaid = true;
    order.paidAt = Date.now();
    order.paymentResult = {
      id: req.body.id,
      status: req.body.status,
      update_time: req.body.update_time,
      email_address: req.body.payer.email_address,
    };
    const updatedOrder = await order.save();
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
  const merchantTransactionId = `M-${uuidv4()}`;
  const amountInPaise = Math.round(order.totalPrice * 100);
  const payload = {
    merchantId: process.env.PHONEPE_MERCHANT_ID,
    merchantTransactionId,
    merchantUserId: req.user._id.toString(),
    amount: amountInPaise,
    redirectUrl: `http://localhost:5173/dashboard/orders?orderId=${order._id}`,
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

// --- ADMIN-ONLY FUNCTIONS ---
const getAllOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({})
    .populate("user", "id name email")
    .sort({ createdAt: -1 });
  res.json(orders);
});

const updateOrderToPaidByAdmin = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (order) {
    order.isPaid = true;
    order.paidAt = Date.now();
    order.paymentResult = {
      id: `admin-${req.user._id}-${Date.now()}`,
      status: "COMPLETED_BY_ADMIN",
      update_time: new Date().toISOString(),
      email_address: order.shippingAddress.email,
    };
    const updatedOrder = await order.save();
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
  createRazorpayOrder,
  verifyPaymentAndUpdateOrder,
  getPaypalClientId,
  updateOrderToPaidWithPaypal,
  createPhonePePayment,
  getMyOrders,
  getAllOrders,
  updateOrderToPaidByAdmin,
  deleteOrder,
};
