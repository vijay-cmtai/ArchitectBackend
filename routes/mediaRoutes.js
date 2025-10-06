const express = require("express");
const router = express.Router();
const {
  getAllProductsForMedia,
} = require("../controllers/admin/mediaController.js");
const { protect, admin } = require("../middleware/authMiddleware.js");

router.route("/all-products").get(protect, admin, getAllProductsForMedia);

module.exports = router;
