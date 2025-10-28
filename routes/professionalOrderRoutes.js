const express = require("express");
const router = express.Router();
const {
  getMyProfessionalOrders,
} = require("../controllers/professionalOrderController.js");
const {
  protect,
  professionalProtect,
} = require("../middleware/authMiddleware.js");

// This route will be used by the professional's dashboard to fetch their sales.
// It is protected to ensure only a logged-in user can access it.
// It is also protected by `professionalProtect` to ensure only users with the 'professional' role can access it.
router
  .route("/my-orders")
  .get(protect, professionalProtect, getMyProfessionalOrders);

module.exports = router;
