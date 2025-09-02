const asyncHandler = require("express-async-handler");
const PremiumRequest = require("../models/premiumRequestModel.js");
const createPremiumRequest = asyncHandler(async (req, res) => {
  const {
    packageName,
    name,
    whatsapp,
    city,
    plotSize,
    totalArea,
    floors,
    spaceType,
    preferredStyle,
    projectDetails,
  } = req.body;

  if (
    !packageName ||
    !name ||
    !whatsapp ||
    !city ||
    !totalArea ||
    !projectDetails
  ) {
    res.status(400);
    throw new Error("Please fill all required fields.");
  }

  const request = await PremiumRequest.create({
    packageName,
    name,
    whatsapp,
    city,
    plotSize,
    totalArea,
    floors,
    spaceType,
    preferredStyle,
    projectDetails,
  });

  res.status(201).json({
    message:
      "Premium request submitted successfully! Our team will contact you shortly.",
    request,
  });
});

const getAllPremiumRequests = asyncHandler(async (req, res) => {
  const requests = await PremiumRequest.find({}).sort({ createdAt: -1 });
  res.json(requests);
});

const updatePremiumRequest = asyncHandler(async (req, res) => {
  const request = await PremiumRequest.findById(req.params.id);

  if (request) {
    request.status = req.body.status || request.status;
    request.adminNotes = req.body.adminNotes || request.adminNotes;

    const updatedRequest = await request.save();
    res.json(updatedRequest);
  } else {
    res.status(404);
    throw new Error("Request not found.");
  }
});

const deletePremiumRequest = asyncHandler(async (req, res) => {
  const request = await PremiumRequest.findById(req.params.id);
  if (request) {
    await request.deleteOne();
    res.json({ message: "Request deleted successfully." });
  } else {
    res.status(404);
    throw new Error("Request not found.");
  }
});

module.exports = {
  createPremiumRequest,
  getAllPremiumRequests,
  updatePremiumRequest,
  deletePremiumRequest,
};
