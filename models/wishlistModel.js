const mongoose = require("mongoose");

// This schema defines the structure of a single item within the wishlist
const wishlistItemSchema = mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product", // This should match the name of your Product model
    required: true,
  },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  salePrice: { type: Number },
  image: { type: String },
  size: { type: String },
});

// This is the main schema for the user's wishlist
const wishlistSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
      unique: true, // Each user has only one wishlist
    },
    items: [wishlistItemSchema],
  },
  {
    timestamps: true,
  }
);

const Wishlist = mongoose.model("Wishlist", wishlistSchema);

module.exports = Wishlist;
