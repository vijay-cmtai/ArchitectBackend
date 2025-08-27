// models/professionalPlanModel.js

const mongoose = require("mongoose");

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
    plotSize: {
      type: String,
      required: [true, "Plot size is required"],
    },
    plotArea: {
      type: Number,
      required: [true, "Plot area is required"],
    },
    rooms: {
      type: Number,
      required: [true, "Number of rooms (BHK) is required"],
      default: 0,
    },
    bathrooms: {
      type: Number,
      default: 0,
    },
    kitchen: {
      type: Number,
      default: 0,
    },
    floors: {
      type: Number,
      default: 1,
    },
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
    country: {
      type: String,
      required: [true, "Country is required"],
    },
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
    price: {
      type: Number,
      required: [true, "Price is required"],
      default: 0,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
    },
    status: {
      type: String,
      enum: ["Published"],
      default: "Pending Review",
    },
    mainImage: {
      type: String,
      required: [true, "Main image is required"],
    },
    galleryImages: [{ type: String }],
    planFile: {
      type: String,
      required: [true, "Plan file is required"],
    },
    
    youtubeLink: {
      type: String,
      trim: true, 
    },
  },
  {
    timestamps: true,
  }
);

const ProfessionalPlan = mongoose.model(
  "ProfessionalPlan",
  professionalPlanSchema
);

module.exports = ProfessionalPlan;