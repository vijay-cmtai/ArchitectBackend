const express = require("express");
const {
  getCart,
  addOrUpdateCartItem,
  removeCartItem,
  clearCart, // Import the new function
} = require("../controllers/cartController.js");
const { protect } = require("../middleware/authMiddleware.js");

const router = express.Router();

// DELETE /api/cart will clear the whole cart
router
  .route("/")
  .get(protect, getCart)
  .post(protect, addOrUpdateCartItem)
  .delete(protect, clearCart);

// DELETE /api/cart/:productId will remove a single item
router.route("/:productId").delete(protect, removeCartItem);

module.exports = router;
