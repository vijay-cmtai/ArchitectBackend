const asyncHandler = require("express-async-handler");
const Cart = require("../models/cartModel.js");

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private
const getCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id }).populate(
    "items.productId",
    "name price"
  );

  if (cart) {
    res.json(cart);
  } else {
    // If no cart exists, create an empty one for the user
    const newCart = await Cart.create({ user: req.user._id, items: [] });
    res.json(newCart);
  }
});

// @desc    Add or update an item in the cart
// @route   POST /api/cart
// @access  Private
const addOrUpdateCartItem = asyncHandler(async (req, res) => {
  const { productId, quantity, name, price, image, size } = req.body;
  const userId = req.user._id;

  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  }

  const existingItem = cart.items.find(
    (item) => item.productId.toString() === productId
  );

  if (existingItem) {
    // If item exists, update its quantity
    existingItem.quantity = quantity;
  } else {
    // If item does not exist, add it to the cart
    cart.items.push({ productId, quantity, name, price, image, size });
  }

  const updatedCart = await cart.save();
  res.status(201).json(updatedCart);
});

// @desc    Remove an item from the cart
// @route   DELETE /api/cart/:productId
// @access  Private
const removeCartItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const userId = req.user._id;

  const cart = await Cart.findOne({ user: userId });

  if (cart) {
    cart.items = cart.items.filter(
      (item) => item.productId.toString() !== productId
    );
    const updatedCart = await cart.save();
    res.json(updatedCart);
  } else {
    res.status(404);
    throw new Error("Cart not found");
  }
});

// @desc    Clear all items from the cart (e.g., after a successful order)
// @route   DELETE /api/cart
// @access  Private
const clearCart = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const cart = await Cart.findOne({ user: userId });

  if (cart) {
    cart.items = [];
    await cart.save();
    res.json({ message: "Cart cleared successfully" });
  } else {
    // If no cart, that's fine, just send success
    res.json({ message: "Cart is already empty" });
  }
});

module.exports = {
  getCart,
  addOrUpdateCartItem,
  removeCartItem,
  clearCart, // Export the new function
};
