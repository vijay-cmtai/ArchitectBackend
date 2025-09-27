const asyncHandler = require("express-async-handler");
const Wishlist = require("../models/wishlistModel.js");

// @desc    Get user's wishlist
// @route   GET /api/wishlist
// @access  Private
const getWishlist = asyncHandler(async (req, res) => {
  let wishlist = await Wishlist.findOne({ user: req.user._id });

  if (wishlist) {
    res.json(wishlist);
  } else {
    wishlist = await Wishlist.create({ user: req.user._id, items: [] });
    res.status(200).json(wishlist);
  }
});

// @desc    Add an item to the wishlist
// @route   POST /api/wishlist/add
// @access  Private
const addToWishlist = asyncHandler(async (req, res) => {
  const { productId, name, price, salePrice, image, size } = req.body;

  if (!productId || !name || price === undefined) {
    res.status(400);
    throw new Error("Product ID, name, and price are required");
  }

  let wishlist = await Wishlist.findOne({ user: req.user._id });
  if (!wishlist) {
    wishlist = await Wishlist.create({ user: req.user._id, items: [] });
  }

  const itemExists = wishlist.items.some(
    (item) => item.productId.toString() === productId
  );

  if (itemExists) {
    return res.status(200).json(wishlist);
  }

  const newItem = {
    productId,
    name,
    price,
    salePrice,
    image,
    size,
  };

  wishlist.items.push(newItem);
  const updatedWishlist = await wishlist.save();

  res.status(201).json(updatedWishlist);
});

// @desc    Remove an item from the wishlist
// @route   DELETE /api/wishlist/remove/:productId
// @access  Private
const removeFromWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const wishlist = await Wishlist.findOne({ user: req.user._id });

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
  const { localWishlistItems } = req.body;
  if (!Array.isArray(localWishlistItems)) {
    res.status(400);
    throw new Error("Invalid local wishlist data");
  }

  let userWishlist = await Wishlist.findOne({ user: req.user._id });
  if (!userWishlist) {
    userWishlist = await Wishlist.create({ user: req.user._id, items: [] });
  }
  for (const localItem of localWishlistItems) {
    const productId = localItem.productId;
    if (!productId) continue;

    const itemExists = userWishlist.items.some(
      (dbItem) => dbItem.productId.toString() === productId
    );

    if (!itemExists) {
      // Assume localItem has all necessary details
      userWishlist.items.push({
        productId: localItem.productId,
        name: localItem.name,
        price: localItem.price,
        salePrice: localItem.salePrice,
        image: localItem.image,
        size: localItem.size,
      });
    }
  }

  const mergedWishlist = await userWishlist.save();
  res.status(200).json(mergedWishlist);
});

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  mergeWishlist,
};
