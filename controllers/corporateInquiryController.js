const asyncHandler = require("express-async-handler");
const CorporateInquiry = require("../models/corporateInquiryModel.js");
const submitInquiry = asyncHandler(async (req, res) => {
  const {
    companyName,
    contactPerson,
    workEmail,
    phoneNumber,
    projectType,
    projectDetails,
  } = req.body;

  if (
    !companyName ||
    !contactPerson ||
    !workEmail ||
    !phoneNumber ||
    !projectType ||
    !projectDetails
  ) {
    res.status(400);
    throw new Error("Please fill all required fields");
  }

  const inquiryData = {
    companyName,
    contactPerson,
    workEmail,
    phoneNumber,
    projectType,
    projectDetails,
  };

  if (req.file) {
    inquiryData.projectBriefUrl = req.file.path;
  }

  const inquiry = await CorporateInquiry.create(inquiryData);

  if (inquiry) {
    res.status(201).json({
      message:
        "Inquiry submitted successfully. We will get back to you shortly.",
      inquiry,
    });
  } else {
    res.status(400);
    throw new Error("Invalid inquiry data");
  }
});
const getAllInquiries = asyncHandler(async (req, res) => {
  const inquiries = await CorporateInquiry.find({}).sort({ createdAt: -1 });
  res.json(inquiries);
});
const getInquiryById = asyncHandler(async (req, res) => {
  const inquiry = await CorporateInquiry.findById(req.params.id);
  if (inquiry) {
    res.json(inquiry);
  } else {
    res.status(404);
    throw new Error("Inquiry not found");
  }
});
const updateInquiry = asyncHandler(async (req, res) => {
  const inquiry = await CorporateInquiry.findById(req.params.id);

  if (inquiry) {
    inquiry.companyName = req.body.companyName || inquiry.companyName;
    inquiry.contactPerson = req.body.contactPerson || inquiry.contactPerson;
    inquiry.workEmail = req.body.workEmail || inquiry.workEmail;
    inquiry.phoneNumber = req.body.phoneNumber || inquiry.phoneNumber;
    inquiry.projectType = req.body.projectType || inquiry.projectType;
    inquiry.projectDetails = req.body.projectDetails || inquiry.projectDetails;
    inquiry.status = req.body.status || inquiry.status;

    const updatedInquiry = await inquiry.save();
    res.json(updatedInquiry);
  } else {
    res.status(404);
    throw new Error("Inquiry not found");
  }
});
const deleteInquiry = asyncHandler(async (req, res) => {
  const inquiry = await CorporateInquiry.findById(req.params.id);

  if (inquiry) {
    await inquiry.deleteOne();
    res.json({ message: "Inquiry removed successfully" });
  } else {
    res.status(404);
    throw new Error("Inquiry not found");
  }
});

module.exports = {
  submitInquiry,
  getAllInquiries,
  getInquiryById,
  updateInquiry,
  deleteInquiry,
};
