const express = require("express");
const {
  addOrderItems,
  getMyOrders,
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
  getOrderByIdForGuest,
} = require("../controllers/orderController.js");

const {
  protect,
  admin,
  softProtect,
} = require("../middleware/authMiddleware.js");

const router = express.Router();

// ==========================================
// PUBLIC & GUEST ROUTES
// ==========================================
router.route("/").post(softProtect, addOrderItems);
router.route("/guest/:orderId").get(getOrderByIdForGuest);

// ==========================================
// USER-ONLY ROUTES (Require login)
// ==========================================
router.route("/myorders").get(protect, getMyOrders);

// ==========================================
// RAZORPAY PAYMENT GATEWAY
// ==========================================
router
  .route("/:id/create-razorpay-order")
  .post(softProtect, createRazorpayOrder);
router
  .route("/:id/verify-payment")
  .post(softProtect, verifyPaymentAndUpdateOrder);

// ==========================================
// PAYPAL PAYMENT GATEWAY
// ==========================================
router.route("/paypal/client-id").get(getPaypalClientId);
router
  .route("/:id/pay-with-paypal")
  .put(softProtect, updateOrderToPaidWithPaypal);

// ==========================================
// PHONEPE V2 PAYMENT GATEWAY (OAuth 2.0)
// ==========================================

// Create PhonePe payment and get redirect URL
router
  .route("/:id/create-phonepe-payment")
  .post(softProtect, createPhonePePayment);

// Webhook endpoint - PhonePe server will call this
// ⚠️ IMPORTANT: This endpoint should NOT have authentication middleware
// PhonePe's servers will call this directly
router.route("/phonepe-webhook").post(handlePhonePeWebhook);

// Manual status check endpoint (if webhook fails or for verification)
// Can be called from frontend to check payment status
router
  .route("/phonepe-status/:merchantTransactionId")
  .get(softProtect, checkPhonePePaymentStatus);

// ==========================================
// ADMIN-ONLY ROUTES (Require admin login)
// ==========================================
router.route("/all").get(protect, admin, getAllOrders);
router.route("/:id").delete(protect, admin, deleteOrder);
router.route("/:id/mark-as-paid").put(protect, admin, updateOrderToPaidByAdmin);

module.exports = router;
