const asyncHandler = require("express-async-handler");
const Inquiry = require("../models/inquiryModel.js");
const User = require("../models/userModel.js");

// @desc    Create a new inquiry from a public contact form
// @route   POST /api/inquiries
// @access  Public
const createInquiry = asyncHandler(async (req, res) => {
  // Frontend se aane wala saara data yahan destructure karein
  const {
    recipient,
    recipientInfo,
    senderName,
    senderEmail,
    senderWhatsapp,
    requirements,
  } = req.body;

  // Step 1: Zaroori fields ki jaanch karein
  if (
    !recipient ||
    !recipientInfo ||
    !senderName ||
    !senderEmail ||
    !senderWhatsapp ||
    !requirements
  ) {
    res.status(400);
    throw new Error("Please fill all required fields.");
  }

  // Step 2: Jaanch karein ki jisey inquiry bheji ja rahi hai, woh valid user hai ya nahi
  const recipientUser = await User.findById(recipient);
  if (
    !recipientUser ||
    !["seller", "Contractor"].includes(recipientUser.role)
  ) {
    res.status(404);
    throw new Error(
      "The professional you are trying to contact does not exist."
    );
  }

  // Step 3: Nayi inquiry ka object banayein
  const inquiry = new Inquiry({
    recipient,
    recipientInfo, // Poora object jisme seller/contractor ki details hain
    senderName,
    senderEmail,
    senderWhatsapp,
    requirements,
    // Agar inquiry bhejnewala user logged in hai, to uski ID save karein
    senderUser: req.user ? req.user._id : null,
  });

  // Step 4: Inquiry ko database me save karein
  const createdInquiry = await inquiry.save();
  res.status(201).json(createdInquiry);
});

// @desc    Get all inquiries for the admin panel
// @route   GET /api/inquiries
// @access  Private/Admin
const getAllInquiries = asyncHandler(async (req, res) => {
  const inquiries = await Inquiry.find({})
    .populate("recipient", "name businessName role email") // Recipient ki thodi details
    .sort({ createdAt: -1 }); // Sabse nayi inquiry sabse upar
  res.json(inquiries);
});

// @desc    Update an inquiry's status (e.g., from 'New' to 'Contacted')
// @route   PUT /api/inquiries/:id/status
// @access  Private/Admin
const updateInquiryStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const inquiry = await Inquiry.findById(req.params.id);

  if (inquiry) {
    if (!["New", "Contacted", "Closed"].includes(status)) {
      res.status(400);
      throw new Error("Invalid status provided.");
    }
    inquiry.status = status;
    const updatedInquiry = await inquiry.save();
    res.json(updatedInquiry);
  } else {
    res.status(404);
    throw new Error("Inquiry not found");
  }
});

// @desc    Delete an inquiry
// @route   DELETE /api/inquiries/:id
// @access  Private/Admin
const deleteInquiry = asyncHandler(async (req, res) => {
  const inquiry = await Inquiry.findById(req.params.id);

  if (inquiry) {
    await inquiry.deleteOne();
    res.json({ message: "Inquiry removed successfully" });
  } else {
    res.status(404);
    throw new Error("Inquiry not found");
  }
});

module.exports = {
  createInquiry,
  getAllInquiries,
  updateInquiryStatus,
  deleteInquiry,
};
