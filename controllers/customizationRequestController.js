const asyncHandler = require("express-async-handler");
const CustomizationRequest = require("../models/customizationRequestModel.js");

const createCustomizationRequest = asyncHandler(async (req, res) => {
  const {
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

  if (!requestType || !name || !email || !whatsappNumber) {
    res.status(400);
    throw new Error("Please fill all required fields.");
  }

  const requestData = { ...req.body };
  if (req.file) {
    requestData.referenceFileUrl = req.file.path;
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

const getAllRequests = asyncHandler(async (req, res) => {
  const requests = await CustomizationRequest.find({}).sort({ createdAt: -1 });
  res.json(requests);
});

// ✨ ======================================================= ✨
// ✨           NAYA UPDATE FUNCTION YAHAN HAI                ✨
// ✨ ======================================================= ✨
const updateRequest = asyncHandler(async (req, res) => {
  const request = await CustomizationRequest.findById(req.params.id);

  if (request) {
    // Admin in fields ko update kar sakta hai
    request.status = req.body.status || request.status;
    request.adminNotes = req.body.adminNotes || request.adminNotes;

    // Yahan aap aur bhi fields update karne ka logic daal sakte hain
    // For example:
    // request.name = req.body.name || request.name;

    const updatedRequest = await request.save();
    res.json(updatedRequest);
  } else {
    res.status(404);
    throw new Error("Request not found.");
  }
});

const deleteRequest = asyncHandler(async (req, res) => {
  const request = await CustomizationRequest.findById(req.params.id);
  if (request) {
    await request.deleteOne();
    res.json({ message: "Request deleted successfully." });
  } else {
    res.status(404);
    throw new Error("Request not found.");
  }
});

// Naye function ko export karna na bhoolein
module.exports = {
  createCustomizationRequest,
  getAllRequests,
  updateRequest, // <-- Ise add karein
  deleteRequest,
};
