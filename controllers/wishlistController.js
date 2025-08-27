const asyncHandler = require("express-async-handler");
const Wishlist = require("../models/wishlistModel.js");
const Product = require("../models/productModel.js"); // Make sure you have a Product model

// @desc    Get user's wishlist
// @route   GET /api/wishlist
// @access  Private
const getWishlist = asyncHandler(async (req, res) => {
  let wishlist = await Wishlist.findOne({ user: req.user._id });

  if (wishlist) {
    res.json(wishlist);
  } else {
    // If no wishlist exists, create an empty one for the user
    wishlist = await Wishlist.create({ user: req.user._id, items: [] });
    res.status(200).json(wishlist);
  }
});

// @desc    Add an item to the wishlist
// @route   POST /api/wishlist/add
// @access  Private
const addToWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  const userId = req.user._id;

  const product = await Product.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  let wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) {
    wishlist = await Wishlist.create({ user: userId, items: [] });
  }

  const itemExists = wishlist.items.some(
    (item) => item.productId.toString() === productId
  );

  if (itemExists) {
    res.status(400);
    throw new Error("Item already in wishlist");
  }

  wishlist.items.push({
    productId: product._id,
    name: product.name,
    price: product.price,
    salePrice: product.salePrice,
    image: product.mainImage || product.image,
    size: product.plotSize,
  });

  const updatedWishlist = await wishlist.save();
  res.status(201).json(updatedWishlist);
});

// @desc    Remove an item from the wishlist
// @route   DELETE /api/wishlist/remove/:productId
// @access  Private
const removeFromWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const userId = req.user._id;

  const wishlist = await Wishlist.findOne({ user: userId });

  if (wishlist) {
    wishlist.items = wishlist.items.filter(
      (item) => item.productId.toString() !== productId
    );
    const updatedWishlist = await wishlist.save();
    res.json(updatedWishlist);
  } else {
    res.status(404);
    throw new Error("Wishlist not found");
  }
});

// @desc    Merge local wishlist with DB after login
// @route   POST /api/wishlist/merge
// @access  Private
const mergeWishlist = asyncHandler(async (req, res) => {
  const { localWishlistItems } = req.body; // Expecting an array of product objects
  const userId = req.user._id;

  if (!Array.isArray(localWishlistItems)) {
    res.status(400);
    throw new Error("Invalid local wishlist data");
  }

  let userWishlist = await Wishlist.findOne({ user: userId });
  if (!userWishlist) {
    userWishlist = await Wishlist.create({ user: userId, items: [] });
  }

  localWishlistItems.forEach((localItem) => {
    const itemExists = userWishlist.items.some(
      (dbItem) => dbItem.productId.toString() === localItem.id
    );
    if (!itemExists) {
      userWishlist.items.push({
        productId: localItem.id,
        name: localItem.name,
        price: localItem.price,
        salePrice: localItem.salePrice,
        image: localItem.image,
        size: localItem.size,
      });
    }
  });

  const mergedWishlist = await userWishlist.save();
  res.status(200).json(mergedWishlist);
});

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  mergeWishlist,
};
