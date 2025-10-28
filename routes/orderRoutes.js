const express = require("express");
const {
  addOrderItems,
  getMyOrders,
  createRazorpayOrder,
  verifyPaymentAndUpdateOrder,
  getPaypalClientId,
  updateOrderToPaidWithPaypal,
  createPhonePePayment,
  handlePhonePeCallback,
  getAllOrders,
  updateOrderToPaidByAdmin,
  deleteOrder,
  getOrderByIdForGuest,
} = require("../controllers/orderController.js");

const {
  protect,
  admin,
  softProtect,
} = require("../middleware/authMiddleware.js");

const router = express.Router();

// --- PUBLIC & GUEST ROUTES ---
router.route("/").post(softProtect, addOrderItems);
router.route("/guest/:orderId").get(getOrderByIdForGuest);

// --- USER-ONLY ROUTES (Require login) ---
router.route("/myorders").get(protect, getMyOrders);

// --- PAYMENT GATEWAY ROUTES ---
router
  .route("/:id/create-razorpay-order")
  .post(softProtect, createRazorpayOrder);
router
  .route("/:id/verify-payment")
  .post(softProtect, verifyPaymentAndUpdateOrder);
router
  .route("/:id/pay-with-paypal")
  .put(softProtect, updateOrderToPaidWithPaypal);
router
  .route("/:id/create-phonepe-payment")
  .post(softProtect, createPhonePePayment);
router.route("/phonepe-callback").post(handlePhonePeCallback); // PhonePe server-to-server call doesn't need protection
router.route("/paypal/client-id").get(getPaypalClientId);

// --- ADMIN-ONLY ROUTES (Require admin login) ---
router.route("/all").get(protect, admin, getAllOrders);
router.route("/:id").delete(protect, admin, deleteOrder);
router.route("/:id/mark-as-paid").put(protect, admin, updateOrderToPaidByAdmin);

module.exports = router;
