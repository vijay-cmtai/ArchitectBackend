// routes/orderRoutes.js

const express = require("express");
const {
  addOrderItems,
  getMyOrders,
  createRazorpayOrder,
  verifyPaymentAndUpdateOrder,
  getPaypalClientId,
  updateOrderToPaidWithPaypal,
  createPhonePePayment,
  getAllOrders,
  updateOrderToPaidByAdmin,
  deleteOrder,
} = require("../controllers/orderController.js");

const { protect, admin } = require("../middleware/authMiddleware.js");

const router = express.Router();

// --- USER ROUTES ---
router.route("/").post(protect, addOrderItems);
router.route("/myorders").get(protect, getMyOrders);
router.route("/paypal/client-id").get(protect, getPaypalClientId);

// --- PAYMENT GATEWAY ROUTES ---
router.route("/:id/create-razorpay-order").post(protect, createRazorpayOrder);
router.route("/:id/verify-payment").post(protect, verifyPaymentAndUpdateOrder);
router.route("/:id/pay-with-paypal").put(protect, updateOrderToPaidWithPaypal);
router.route("/:id/create-phonepe-payment").post(protect, createPhonePePayment);

// --- ADMIN ROUTES ---
router.route("/all").get(protect, admin, getAllOrders);

router.route("/:id").delete(protect, admin, deleteOrder);

router.route("/:id/mark-as-paid").put(protect, admin, updateOrderToPaidByAdmin);

module.exports = router;
