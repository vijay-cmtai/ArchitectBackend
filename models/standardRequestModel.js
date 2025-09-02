const mongoose = require("mongoose");

const standardRequestSchema = mongoose.Schema(
  {
    packageName: {
      type: String,
      required: [true, "Package name is required"],
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

const StandardRequest = mongoose.model(
  "StandardRequest",
  standardRequestSchema
);

module.exports = StandardRequest;
