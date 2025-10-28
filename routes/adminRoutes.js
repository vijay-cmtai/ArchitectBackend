// routes/adminRoutes.js

const express = require("express");
const router = express.Router();
const { protect, admin } = require("../middleware/authMiddleware");

const {
  getDashboardSummary,
  getAllUsers,
  updateUser,
  deleteUser,
  getAllOrders,
  updateOrderToPaid,
  deleteOrder,
  getAllAdminProducts,
  getAllProfessionalPlans,
  updateProfessionalPlanStatus,
  deleteProfessionalPlan,
  getAllRequestsAndInquiries,
  getReportsData, 
} = require("../controllers/adminController.js");

router.use(protect, admin);

// Dashboard
router.route("/summary").get(getDashboardSummary);

// User Management
router.route("/users").get(getAllUsers);
router.route("/users/:id").put(updateUser).delete(deleteUser);

// Order Management
router.route("/orders").get(getAllOrders);
router.route("/orders/:id").delete(deleteOrder);
router.route("/orders/:id/pay").put(updateOrderToPaid);

// Product & Plan Management
router.route("/products").get(getAllAdminProducts);
router.route("/professional-plans").get(getAllProfessionalPlans);
router.route("/professional-plans/:id").delete(deleteProfessionalPlan);
router
  .route("/professional-plans/:id/status")
  .put(updateProfessionalPlanStatus);

// Requests and Inquiries
router.route("/requests-inquiries").get(getAllRequestsAndInquiries);

// Reports
router.route("/reports-data").get(getReportsData);

module.exports = router;
