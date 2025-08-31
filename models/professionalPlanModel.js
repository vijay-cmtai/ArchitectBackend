// models/professionalPlanModel.js

const mongoose = require("mongoose");

// ++ CHANGE HERE: Added the same review schema as in the product model
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

const professionalPlanSchema = mongoose.Schema(
  {
    professional: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    planName: {
      type: String,
      required: [true, "Plan name is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
    },
    // ... all other fields remain the same ...
    plotSize: { type: String, required: [true, "Plot size is required"] },
    plotArea: { type: Number, required: [true, "Plot area is required"] },
    rooms: {
      type: Number,
      required: [true, "Number of rooms (BHK) is required"],
      default: 0,
    },
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
    country: { type: String, required: [true, "Country is required"] },
    planType: {
      type: String,
      required: [true, "Plan type is required"],
      enum: [
        "Floor Plans",
        "3D Elevations",
        "Interior Designs",
        "Construction Products",
      ],
    },
    price: { type: Number, required: [true, "Price is required"], default: 0 },
    category: { type: String, required: [true, "Category is required"] },
    status: { type: String, enum: ["Published"], default: "Published" },
    mainImage: { type: String, required: [true, "Main image is required"] },
    galleryImages: [{ type: String }],
    planFile: { type: String, required: [true, "Plan file is required"] },
    youtubeLink: { type: String, trim: true },

    // ++ CHANGE HERE: Added rating, numReviews, and the reviews array
    rating: { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 },
    reviews: [reviewSchema],
  },
  {
    timestamps: true,
  }
);

// ++ CHANGE HERE: Added middleware to auto-calculate average rating
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
