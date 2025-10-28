// controllers/customizationRequestController.js

const asyncHandler = require("express-async-handler");
const CustomizationRequest = require("../models/customizationRequestModel.js");

// @desc    Create a new customization request
// @route   POST /api/customization-requests
// @access  Public
const createCustomizationRequest = asyncHandler(async (req, res) => {
  const {
    // ++ CHANGE HERE: Destructure 'country' from the request body ++
    country,
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

  // ++ CHANGE HERE: Add 'country' to the validation check ++
  if (!country || !requestType || !name || !email || !whatsappNumber) {
    res.status(400);
    throw new Error("Please fill all required fields.");
  }

  // ++ CHANGE HERE: Explicitly build the request data object to map 'country' to 'countryName' ++
  const requestData = {
    countryName: country, // Map the 'country' form field to the 'countryName' model field
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
