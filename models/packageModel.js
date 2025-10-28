const mongoose = require("mongoose");

const packageSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: String,
      required: true,
    },
    unit: {
      type: String,
      required: true,
    },
    areaType: {
      type: String,
      default: "",
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    packageType: {
      type: String,
      required: true,
      enum: ["standard", "premium"], 
    },
    features: {
      type: [String],
      default: [],
    },
    includes: {
      type: [String],
      default: [],
    },
    note: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

const Package = mongoose.model("Package", packageSchema);

module.exports = Package; 
