const mongoose = require("mongoose");

const customizationRequestSchema = mongoose.Schema(
  {
    requestType: {
      type: String,
      required: true,
      enum: ["Floor Plan Customization", "3D Elevation", "Interior Design"],
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
    // Form se aane wale baaki saare fields
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

    // Admin dwara update kiye jaane wale fields
    status: {
      type: String,
      // ✨ YAHAN BADLAAV HAI: Enum values ko frontend se match kiya gaya hai ✨
      enum: ["Pending", "Contacted", "In Progress", "Completed", "Cancelled"],
      default: "Pending", // Default status ab 'Pending' hai
    },
    adminNotes: {
      type: String,
      default: "", // Default khaali string rakhein
    },
  },
  {
    timestamps: true,
  }
);

const CustomizationRequest = mongoose.model(
  "CustomizationRequest",
  customizationRequestSchema
);

module.exports = CustomizationRequest;
