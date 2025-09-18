// src/controllers/cartController.js

const asyncHandler = require("express-async-handler");
const Cart = require("../models/cartModel.js");
const Product = require("../models/productModel.js"); // Product model ko import karein

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private
const getCart = asyncHandler(async (req, res) => {
  // Populate mein saari zaroori fields add karein
  const cart = await Cart.findOne({ user: req.user._id }).populate(
    "items.productId",
    "name price salePrice isSale taxRate discountPercentage" // Yahan fields add ki gayi hain
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
  // Client se sirf productId aur quantity lein. Size optional ho sakta hai.
  const { productId, quantity, size } = req.body;
  const userId = req.user._id;

  // Product ki details database se fetch karein
  const product = await Product.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  }

  const existingItemIndex = cart.items.findIndex(
    (item) => item.productId.toString() === productId
  );

  if (existingItemIndex > -1) {
    // If item exists, update its quantity
    cart.items[existingItemIndex].quantity = quantity;
  } else {
    // If item does not exist, add it to the cart with all details from the product
    const cartItem = {
      productId: product._id,
      name: product.name,
      quantity,
      // Store the effective price (sale price if available, otherwise regular price)
      price:
        product.isSale && product.salePrice > 0
          ? product.salePrice
          : product.price,
      // Store all other relevant details
      salePrice: product.salePrice,
      isSale: product.isSale,
      taxRate: product.taxRate,
      discountPercentage: product.discountPercentage,
      image: product.mainImage, // Assuming mainImage is the correct field
      size: size || product.plotSize, // Use provided size or default from product
    };
    cart.items.push(cartItem);
  }

  const updatedCart = await cart.save();
  // Response mein updated cart ko populate karke bhejein taaki frontend ko hamesha latest data mile
  const populatedCart = await updatedCart.populate(
    "items.productId",
    "name price salePrice isSale taxRate discountPercentage"
  );
  res.status(201).json(populatedCart);
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
  clearCart,
};
