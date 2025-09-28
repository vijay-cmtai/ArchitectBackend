const asyncHandler = require("express-async-handler");
const Cart = require("../models/cartModel.js");
const Product = require("../models/productModel.js");
const ProfessionalPlan = require("../models/professionalPlanModel.js");

// --- हेल्पर फंक्शन (यहीं पर सारे फिक्स हैं) ---
const getPlanDetails = async (productId) => {
  let plan = await Product.findById(productId).lean(); // .lean() for faster, plain JS object
  if (plan) {
    // FIX 1: Price को सही से पढ़ें
    const regularPrice =
      plan.price !== 0 && plan.price
        ? plan.price
        : (plan["Regular price"] ?? 0);
    const salePrice =
      plan.salePrice !== 0 && plan.salePrice
        ? plan.salePrice
        : plan["Sale price"];

    // FIX 2: isSale का लॉजिक अब JSON डेटा को भी समझेगा
    const isSale =
      plan.isSale ??
      (salePrice != null && salePrice > 0 && salePrice < regularPrice);

    return {
      productId: plan._id,
      name: plan.name || plan.Name,
      price: isSale && salePrice != null ? salePrice : regularPrice,
      salePrice: salePrice,
      isSale: isSale,
      image:
        plan.mainImage ||
        (plan.Images ? plan.Images.split(",")[0].trim() : undefined),
      size: plan.plotSize || plan["Attribute 1 value(s)"],
      // FIX 3: Tax को सही से पढ़ें
      taxRate: plan.taxRate || plan["Tax class"] || 0,
    };
  }

  plan = await ProfessionalPlan.findById(productId).lean();
  if (plan) {
    return {
      productId: plan._id,
      name: plan.planName,
      price: plan.isSale && plan.salePrice ? plan.salePrice : plan.price,
      salePrice: plan.salePrice,
      isSale: plan.isSale,
      image: plan.mainImage,
      size: plan.plotSize,
      taxRate: plan.taxRate || 0,
    };
  }

  return null;
};

// @desc    Get user's cart
const getCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (cart) {
    res.json(cart);
  } else {
    const newCart = await Cart.create({ user: req.user._id, items: [] });
    res.json(newCart);
  }
});

// @desc    Add or update an item in the cart
const addOrUpdateCartItem = asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;
  const userId = req.user._id;

  if (!productId || !quantity) {
    res.status(400);
    throw new Error("Product ID and quantity are required.");
  }

  // अब यह हेल्पर फंक्शन सही जानकारी (taxRate सहित) लाएगा
  const productDetails = await getPlanDetails(productId);
  if (!productDetails) {
    res.status(404);
    throw new Error("Product not found");
  }

  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = new Cart({ user: userId, items: [] });
  }

  const existingItemIndex = cart.items.findIndex(
    (item) => item.productId.toString() === productId
  );

  if (existingItemIndex > -1) {
    cart.items[existingItemIndex].quantity = quantity;
  } else {
    cart.items.push({
      ...productDetails,
      quantity: quantity,
    });
  }

  const updatedCart = await cart.save();
  res.status(201).json(updatedCart);
});

// @desc    Remove an item from the cart
const removeCartItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const cart = await Cart.findOne({ user: req.user._id });

  if (cart) {
    cart.items = cart.items.filter(
      (item) => item.productId.toString() !== productId
    );
    await cart.save();
    res.json(cart);
  } else {
    res.status(404);
    throw new Error("Cart not found");
  }
});

// @desc    Clear all items from the cart
const clearCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });

  if (cart) {
    cart.items = [];
    await cart.save();
    res.json({ message: "Cart cleared successfully" });
  } else {
    res.json({ message: "Cart is already empty" });
  }
});

module.exports = {
  getCart,
  addOrUpdateCartItem,
  removeCartItem,
  clearCart,
};
