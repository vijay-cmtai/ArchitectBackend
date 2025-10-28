// models/customizationRequestModel.js

const mongoose = require("mongoose");

const customizationRequestSchema = mongoose.Schema(
  {
    // ++ CHANGE HERE: Added countryName field ++
    countryName: {
      type: String,
      required: [false, "Country name is required."],
      trim: true,
    },
    requestType: {
      type: String,
      required: true,
      enum: [
        "Floor Plan Customization",
        "3D Elevation",
        "Interior Design",
        "3D Video Walkthrough",
      ],
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    whatsappNumber: {
      type: String,
      required: true,
    },
    // Form fields for different request types
    width: { type: String },
    length: { type: String },
    roomWidth: { type: String },
    roomLength: { type: String },
    facingDirection: { type: String },
    planForFloor: { type: String },
    elevationType: { type: String, enum: ["Front", "Corner"] },
    designFor: { type: String },
    description: { type: String },
    referenceFileUrl: { type: String },

    // Admin fields
    status: {
      type: String,
      enum: ["Pending", "Contacted", "In Progress", "Completed", "Cancelled"],
      default: "Pending",
    },
    adminNotes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  }
);

const CustomizationRequest = mongoose.model(
  "CustomizationRequest",
  customizationRequestSchema
);

module.exports = CustomizationRequest;
