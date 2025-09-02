const mongoose = require("mongoose");

const inquirySchema = mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    recipientInfo: {
      name: { type: String, required: true }, 
      role: { type: String, required: true }, 
      phone: { type: String },
      city: { type: String },
      address: { type: String },
      detail: { type: String }, 
    },
    senderName: {
      type: String,
      required: [true, "Your name is required"],
    },
    senderEmail: {
      type: String,
      required: [true, "Your email is required"],
    },
    senderWhatsapp: {
      type: String,
      required: [true, "Your WhatsApp number is required"],
    },
    requirements: {
      type: String,
      required: [true, "Please describe your requirements"],
    },
    status: {
      type: String,
      enum: ["New", "Contacted", "Closed"],
      default: "New",
    },
    senderUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Inquiry = mongoose.model("Inquiry", inquirySchema);

module.exports = Inquiry;
