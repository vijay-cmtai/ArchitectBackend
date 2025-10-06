// File: models/product.model.js

const mongoose = require("mongoose");

const reviewSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    rating: { type: Number, required: true },
    comment: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
  },
  { timestamps: true }
);

const productSchema = mongoose.Schema(
  {
    // --- SIRF YE 3 FIELDS REQUIRED HAIN ---
    name: { type: String, required: true, trim: true, alias: "Name" },
    productNo: { type: String, required: true, unique: true },
    price: { type: Number, required: true, default: 0, alias: "Regular price" },
    description: { type: String },
    salePrice: { type: Number, default: 0, alias: "Sale price" },
    category: { type: [String], alias: "Categories" },
    youtubeLink: { type: String, trim: true },
    plotSize: { type: String },
    plotArea: { type: Number },
    rooms: { type: Number, default: 0 },
    bathrooms: { type: String },
    kitchen: { type: String },
    floors: { type: String },
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
    city: { type: String },
    country: { type: [String] },
    planType: {
      type: String,
      enum: [
        "Floor Plans",
        "Floor Plan + 3D Elevations",
        "Interior Designs",
        "Construction Products",
        "Downloads",
      ],
    },
    propertyType: {
      type: String,
      enum: ["Residential", "Commercial", "Rental"],
    },
    isSale: { type: Boolean, default: false },
    taxRate: { type: Number, default: 0 },
    mainImage: { type: String, alias: "Images", required: false },

    galleryImages: [{ type: String }],
    planFile: { type: [String] },
    headerImage: { type: String },
    seo: {
      title: { type: String, trim: true, default: "" },
      description: { type: String, trim: true, default: "" },
      keywords: [{ type: String, trim: true }],
      altText: { type: String, trim: true, default: "" },
    },
    crossSellProducts: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    ],
    upSellProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    contactDetails: {
      name: { type: String, trim: true },
      email: { type: String, trim: true },
      phone: { type: String, trim: true },
    },

    ID: { type: Number, index: true }, // Legacy ID
    Type: { type: String },
    SKU: { type: String },
    Published: { type: Number },
    "Is featured?": { type: Number },
    "Visibility in catalog": { type: String },
    "Short description": { type: String },
    "Tax status": { type: String },
    "Tax class": { type: Number },
    "In stock?": { type: Number },
    Stock: { type: Number, default: null },
    "Backorders allowed?": { type: Number },
    "Allow customer reviews?": { type: Number },
    "Purchase note": { type: String },
    Tags: { type: String },
    Upsells: { type: String },
    "Cross-sells": { type: String },
    Position: { type: Number },

    "Download 1 ID": { type: String },
    "Download 1 name": { type: String },
    "Download 1 URL": { type: String },
    "Download 2 ID": { type: String },
    "Download 2 name": { type: String },
    "Download 2 URL": { type: String },
    "Download 3 ID": { type: String },
    "Download 3 name": { type: String },
    "Download 3 URL": { type: String },
    "Download 4 ID": { type: String },
    "Download 4 name": { type: String },
    "Download 4 URL": { type: String },
    "Download 5 ID": { type: String },
    "Download 5 name": { type: String },
    "Download 5 URL": { type: String },
    "Download 6 ID": { type: String },
    "Download 6 name": { type: String },
    "Download 6 URL": { type: String },
    "Download 7 ID": { type: String },
    "Download 7 name": { type: String },
    "Download 7 URL": { type: String },

    "Attribute 1 name": { type: String },
    "Attribute 1 value(s)": { type: String },
    "Attribute 1 visible": { type: Number },
    "Attribute 1 global": { type: Number },
    "Attribute 2 name": { type: String },
    "Attribute 2 value(s)": { type: String },
    "Attribute 2 visible": { type: Number },
    "Attribute 2 global": { type: Number },
    "Attribute 3 name": { type: String },
    "Attribute 3 value(s)": { type: String },
    "Attribute 3 visible": { type: Number },
    "Attribute 3 global": { type: Number },
    "Attribute 4 name": { type: String },
    "Attribute 4 value(s)": { type: String },
    "Attribute 4 visible": { type: Number },
    "Attribute 4 global": { type: Number },
    "Attribute 5 name": { type: String },
    "Attribute 5 value(s)": { type: String },
    "Attribute 5 visible": { type: Number },
    "Attribute 5 global": { type: Number },
    "Attribute 6 name": { type: String },
    "Attribute 6 value(s)": { type: String },
    "Attribute 6 visible": { type: Number, default: null },
    "Attribute 6 global": { type: Number, default: null },
    "Attribute 7 name": { type: String },
    "Attribute 7 value(s)": { type: String },
    "Attribute 7 visible": { type: Number, default: null },
    "Attribute 7 global": { type: Number, default: null },
    "Attribute 8 name": { type: String },
    "Attribute 8 value(s)": { type: String },
    "Attribute 8 visible": { type: Number, default: null },
    "Attribute 8 global": { type: Number, default: null },
    "Attribute 9 name": { type: String },
    "Attribute 9 value(s)": { type: String },
    "Attribute 9 visible": { type: Number, default: null },
    "Attribute 9 global": { type: Number, default: null },

    rating: { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 },
    reviews: [reviewSchema],
    status: {
      type: String,
      enum: ["Published", "Pending Review", "Draft"],
      default: "Published",
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
  }
);

productSchema.pre("save", function (next) {
  if (this.isModified("reviews")) {
    const totalRating = this.reviews.reduce(
      (acc, item) => item.rating + acc,
      0
    );
    this.numReviews = this.reviews.length;
    this.rating = this.numReviews > 0 ? totalRating / this.numReviews : 0;
  }
  next();
});

const Product = mongoose.model("Product", productSchema);
module.exports = Product;
