const mongoose = require("mongoose");

const premiumRequestSchema = mongoose.Schema(
  {
    packageName: {
      type: String,
      required: [true, "Package name is required"],
      // Example values
      enum: [
        "Premium Floor Plan",
        "Premium Floor Plan + 3D",
        "Premium Complete File + Interior",
      ],
    },
    name: {
      type: String,
      required: [true, "Name is required"],
    },
    whatsapp: {
      type: String,
      required: [true, "WhatsApp number is required"],
    },
    city: {
      type: String,
      required: [true, "City is required"],
    },
    plotSize: {
      type: String,
    },
    totalArea: {
      type: Number,
      required: [true, "Total area is required"],
    },
    floors: {
      type: String,
    },
    spaceType: {
      type: String,
      required: true,
      enum: ["Residential", "Commercial"],
    },
    preferredStyle: {
      type: String,
    },
    projectDetails: {
      type: String,
      required: [true, "Project details are required"],
    },
    // Fields for admin use
    status: {
      type: String,
      enum: ["Pending", "Contacted", "In Progress", "Completed", "Cancelled"],
      default: "Pending",
    },
    adminNotes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const PremiumRequest = mongoose.model("PremiumRequest", premiumRequestSchema);

module.exports = PremiumRequest;
