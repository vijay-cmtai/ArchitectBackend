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

const professionalPlanSchema = mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    productNo: { type: String, required: true, unique: true },
    price: { type: Number, required: true, default: 0 },
    salePrice: { type: Number, default: 0 },
    category: { type: [String], required: true },
    youtubeLink: { type: String, trim: true },
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
    city: { type: String, required: true },
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
    propertyType: {
      type: String,
      required: true,
      enum: ["Residential", "Commercial"],
    },
    isSale: { type: Boolean, default: false },
    taxRate: { type: Number, default: 0 },
    mainImage: { type: String, required: true },
    galleryImages: [{ type: String }],
    planFile: { type: [String], required: true },
    headerImage: { type: String },
    seo: {
      title: { type: String, trim: true, default: "" },
      description: { type: String, trim: true, default: "" },
      keywords: { type: String, trim: true, default: "" },
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
    rating: { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 },
    reviews: [reviewSchema],
    status: {
      type: String,
      enum: ["Published", "Pending Review", "Draft", "Approved"],
      default: "Pending Review",
    },
    // Legacy Fields from Product Model
    ID: { type: Number, index: true },
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
    Tags: { type: String },
    Upsells: { type: String },
    "Cross-sells": { type: String },
    Position: { type: Number },
    "Download 1 URL": { type: String },
    "Download 2 URL": { type: String },
    "Download 3 URL": { type: String },
    "Attribute 1 name": { type: String },
    "Attribute 1 value(s)": { type: String },
    "Attribute 2 name": { type: String },
    "Attribute 2 value(s)": { type: String },
    "Attribute 3 name": { type: String },
    "Attribute 3 value(s)": { type: String },
    "Attribute 4 name": { type: String },
    "Attribute 4 value(s)": { type: String },
    "Attribute 5 name": { type: String },
    "Attribute 5 value(s)": { type: String },
  },
  {
    timestamps: true,
  }
);

professionalPlanSchema.pre("save", function (next) {
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

const ProfessionalPlan = mongoose.model(
  "ProfessionalPlan",
  professionalPlanSchema
);
module.exports = ProfessionalPlan;
