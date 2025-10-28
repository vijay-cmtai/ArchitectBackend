const express = require("express");
const router = express.Router();
const {
  getSellerDashboardData,
} = require("../controllers/sellerDashboardController.js");
const { protect, sellerProtect } = require("../middleware/authMiddleware.js");

router.route("/").get(protect, sellerProtect, getSellerDashboardData);

module.exports = router;
