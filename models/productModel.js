const mongoose = require("mongoose");

const reviewSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    rating: { type: Number, required: true },
    comment: { type: String, required: true },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

const productSchema = mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
    },
    productNo: {
      type: String,
      required: [true, "Product Number is required"],
      unique: true,
    },
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
    city: { type: [String], required: true },
    country: { type: [String], required: true },
    planType: {
      type: String,
      required: true,
      enum: [
        "Floor Plans",
        "Floor Plan + 3D Elevations",
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
    planFile: { type: [String], required: true },
    headerImage: { type: String },
    rating: { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 },
    youtubeLink: { type: String, trim: true },
    reviews: [reviewSchema],
    contactDetails: {
      name: { type: String, trim: true },
      email: { type: String, trim: true },
      phone: { type: String, trim: true },
    },
    seo: {
      title: { type: String, trim: true, default: "" },
      description: { type: String, trim: true, default: "" },
      keywords: { type: String, trim: true, default: "" },
      altText: { type: String, trim: true, default: "" }, // Alt Text for mainImage
    },
    taxRate: { type: Number, default: 0 }, // e.g., 18 for 18%
    discountPercentage: { type: Number, default: 0, min: 0, max: 100 },
    crossSellProducts: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    ],
    upSellProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
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
