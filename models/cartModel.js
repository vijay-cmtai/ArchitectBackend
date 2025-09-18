// src/models/cartModel.js

const mongoose = require("mongoose");

const cartItemSchema = mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1 },
  // Original price of the product
  price: { type: Number, required: true },
  // Sale price if the item is on sale
  salePrice: { type: Number },
  isSale: { type: Boolean, default: false },
  // These fields will be copied from the Product model
  taxRate: { type: Number, default: 0 },
  discountPercentage: { type: Number, default: 0 },
  image: { type: String },
  size: { type: String }, // Assuming size comes from the client
});

const cartSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
      unique: true,
    },
    items: [cartItemSchema],
  },
  {
    timestamps: true,
  }
);

const Cart = mongoose.model("Cart", cartSchema);

module.exports = Cart;
