const mongoose = require("mongoose");

const corporateInquirySchema = mongoose.Schema(
  {
    companyName: {
      type: String,
      required: [true, "Company name is required"],
    },
    contactPerson: {
      type: String,
      required: [true, "Contact person name is required"],
    },
    workEmail: {
      type: String,
      required: [true, "Work email is required"],
      match: [/.+\@.+\..+/, "Please fill a valid email address"],
    },
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required"],
    },
    projectType: {
      type: String,
      required: true,
      enum: [
        "Builders & Colonizers",
        "Offices & Shops",
        "Factories & Educational",
      ],
    },
    projectDetails: {
      type: String,
      required: [true, "Project details are required"],
    },
    projectBriefUrl: {
      type: String,
    },
    status: {
      type: String,
      enum: ["New", "Contacted", "In Progress", "Closed"],
      default: "New",
    },
  },
  {
    timestamps: true,
  }
);

const CorporateInquiry = mongoose.model(
  "CorporateInquiry",
  corporateInquirySchema
);

module.exports = CorporateInquiry;
