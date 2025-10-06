// controllers/customizationRequestController.js

const asyncHandler = require("express-async-handler");
const CustomizationRequest = require("../models/customizationRequestModel.js");

// @desc    Create a new customization request
// @route   POST /api/customization-requests
// @access  Public
const createCustomizationRequest = asyncHandler(async (req, res) => {
  const {
    // ++ FIX HERE: Destructure 'countryName' instead of 'country' ++
    countryName,
    requestType,
    name,
    email,
    whatsappNumber,
    width,
    length,
    roomWidth,
    roomLength,
    facingDirection,
    planForFloor,
    elevationType,
    designFor,
    description,
  } = req.body;

  // ++ FIX HERE: Add 'countryName' to the validation check ++
  if (!countryName || !requestType || !name || !email || !whatsappNumber) {
    res.status(400);
    throw new Error("Please fill all required fields.");
  }

  // Build the request data object. No more mapping needed.
  const requestData = {
    countryName,
    requestType,
    name,
    email,
    whatsappNumber,
    width,
    length,
    roomWidth,
    roomLength,
    facingDirection,
    planForFloor,
    elevationType,
    designFor,
    description,
  };

  // If a file was uploaded, add its path to our data object
  if (req.file) {
    requestData.referenceFileUrl = req.file.location;
  }

  const request = await CustomizationRequest.create(requestData);

  if (request) {
    res.status(201).json({
      message:
        "Request submitted successfully! Our team will contact you shortly.",
      request,
    });
  } else {
    res.status(400);
    throw new Error("Invalid request data.");
  }
});

// @desc    Get all requests
// @route   GET /api/customization-requests
// @access  Private/Admin
const getAllRequests = asyncHandler(async (req, res) => {
  const requests = await CustomizationRequest.find({}).sort({ createdAt: -1 });
  res.json(requests);
});

// @desc    Update a request (status, notes, etc.)
// @route   PUT /api/customization-requests/:id
// @access  Private/Admin
const updateRequest = asyncHandler(async (req, res) => {
  const request = await CustomizationRequest.findById(req.params.id);

  if (request) {
    // Admin can update these fields
    request.status = req.body.status || request.status;
    request.adminNotes = req.body.adminNotes || request.adminNotes;

    const updatedRequest = await request.save();
    res.json(updatedRequest);
  } else {
    res.status(404);
    throw new Error("Request not found.");
  }
});

// @desc    Delete a request
// @route   DELETE /api/customization-requests/:id
// @access  Private/Admin
const deleteRequest = asyncHandler(async (req, res) => {
  const request = await CustomizationRequest.findById(req.params.id);
  if (request) {
    await request.deleteOne(); // Use deleteOne() for Mongoose v6+
    res.json({ message: "Request deleted successfully." });
  } else {
    res.status(404);
    throw new Error("Request not found.");
  }
});

module.exports = {
  createCustomizationRequest,
  getAllRequests,
  updateRequest,
  deleteRequest,
};
