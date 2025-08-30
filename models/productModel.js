const mongoose = require("mongoose");

const productSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
    },
    // ... baaki saare fields (plotSize, plotArea, etc.) waise hi rahenge
    plotSize: { type: String, required: true },
    plotArea: { type: Number, required: true },
    rooms: { type: Number, required: true, default: 0 },
    bathrooms: { type: Number, default: 0 },
    kitchen: { type: Number, default: 0 },
    floors: { type: Number, default: 1 },
    direction: {
      type: String,
      enum: [
        "North",
        "South",
        "East",
        "West",
        "North-East",
        "North-West",
        "South-East",
        "South-West",
      ],
    },
    country: { type: String, required: true },
    planType: {
      type: String,
      required: true,
      enum: [
        "Floor Plans",
        "Floor Plans + 3D Elevations",
        "Interior Designs",
        "Construction Products",
      ],
    },
    price: { type: Number, required: true, default: 0 },
    salePrice: { type: Number, default: 0 },
    isSale: { type: Boolean, default: false },
    category: { type: String, required: true },
    propertyType: { type: String, enum: ["Residential", "Commercial"] },
    status: {
      type: String,
      enum: ["Published", "Pending Review", "Draft"],
      default: "Pending Review",
    },
    mainImage: { type: String, required: true },
    galleryImages: [{ type: String }],
    planFile: { type: String, required: true },
    rating: { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 },

    // ✨ YEH NAYA FIELD ADD KIYA GAYA HAI ✨
    youtubeLink: {
      type: String,
      trim: true, // Extra spaces ko hata dega
    },
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
