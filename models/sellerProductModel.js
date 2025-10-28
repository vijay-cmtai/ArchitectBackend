const mongoose = require("mongoose");

const sellerProductSchema = mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    // <<< YAHAN BADLAAV KIYA GAYA HAI >>>
    city: {
      type: String,
      required: [true, "City is required for the product"],
    },
    // <<< BADLAAV KHATAM >>>
    name: {
      type: String,
      required: [true, "Please enter product name"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Please enter product description"],
    },
    image: {
      type: String,
      required: [true, "Main image is required"],
    },
    images: [
      {
        type: String,
      },
    ],
    brand: {
      type: String,
      required: [false, "Please enter the brand name"],
    },
    category: {
      type: String,
      required: [true, "Please select a category"],
    },
    price: {
      type: Number,
      required: [true, "Please enter product price"],
      default: 0,
    },
    salePrice: {
      type: Number,
      default: 0,
    },
    countInStock: {
      type: Number,
      required: false,
      default: 0,
    },
    isApproved: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Approved",
    },
  },
  {
    timestamps: true,
  }
);

const SellerProduct = mongoose.model("SellerProduct", sellerProductSchema);

module.exports = SellerProduct;
