const express = require("express");
const {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  mergeWishlist,
} = require("../controllers/wishlistController.js");
const { protect } = require("../middleware/authMiddleware.js");

const router = express.Router();

// All routes are protected and require a logged-in user
router.route("/").get(protect, getWishlist);
router.route("/add").post(protect, addToWishlist);
router.route("/merge").post(protect, mergeWishlist);
router.route("/remove/:productId").delete(protect, removeFromWishlist);

module.exports = router;
