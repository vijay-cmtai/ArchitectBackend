// controllers/wishlistController.js

const asyncHandler = require("express-async-handler");
const Wishlist = require("../models/wishlistModel.js");
const Product = require("../models/productModel.js");
const ProfessionalPlan = require("../models/professionalPlanModel.js");

// Helper function to get product/plan details from either model
const getPlanDetails = async (productId) => {
  let plan = await Product.findById(productId);
  if (plan) {
    return {
      productId: plan._id,
      name: plan.name,
      price: plan.price,
      salePrice: plan.salePrice,
      image: plan.mainImage || plan.image,
      size: plan.plotSize,
    };
  }

  plan = await ProfessionalPlan.findById(productId);
  if (plan) {
    // Normalize professional plan to match wishlist item structure
    return {
      productId: plan._id,
      name: plan.planName,
      price: plan.price,
      salePrice: plan.salePrice, // Assuming professional plans can also be on sale
      image: plan.mainImage,
      size: plan.plotSize,
    };
  }

  return null; // Return null if not found in either collection
};

// @desc    Get user's wishlist
// @route   GET /api/wishlist
// @access  Private
const getWishlist = asyncHandler(async (req, res) => {
  let wishlist = await Wishlist.findOne({ user: req.user._id });

  if (wishlist) {
    res.json(wishlist);
  } else {
    // If no wishlist exists, create and return an empty one
    wishlist = await Wishlist.create({ user: req.user._id, items: [] });
    res.status(200).json(wishlist);
  }
});

// @desc    Add an item to the wishlist
// @route   POST /api/wishlist/add
// @access  Private
const addToWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  if (!productId) {
    res.status(400);
    throw new Error("Product ID is required");
  }

  const planDetails = await getPlanDetails(productId);
  if (!planDetails) {
    res.status(404);
    throw new Error("Product or Plan not found");
  }

  let wishlist = await Wishlist.findOne({ user: req.user._id });
  if (!wishlist) {
    wishlist = await Wishlist.create({ user: req.user._id, items: [] });
  }

  const itemExists = wishlist.items.some(
    (item) => item.productId.toString() === productId
  );
  if (itemExists) {
    // Item is already in wishlist, no need to add again. Return current wishlist.
    return res.status(200).json(wishlist);
  }

  wishlist.items.push(planDetails);
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
    // Note: localItem should have `id` which is the productId
    const productId = localItem.id || localItem.productId;
    if (!productId) continue;

    const itemExists = userWishlist.items.some(
      (dbItem) => dbItem.productId.toString() === productId
    );

    if (!itemExists) {
      const planDetails = await getPlanDetails(productId);
      if (planDetails) {
        userWishlist.items.push(planDetails);
      }
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
