// routes/customizationRequestRoutes.js
// NO CHANGES NEEDED IN THIS FILE!

const express = require("express");
const router = express.Router();
const {
  createCustomizationRequest,
  getAllRequests,
  updateRequest,
  deleteRequest,
} = require("../controllers/customizationRequestController.js");
const upload = require("../middleware/uploadMiddleware.js");
const { protect, admin } = require("../middleware/authMiddleware.js");

// Route for creating a new request and getting all requests
router
  .route("/")
  .post(upload.single("referenceFile"), createCustomizationRequest)
  .get(protect, admin, getAllRequests);

// Route for updating and deleting a specific request by ID
router
  .route("/:id")
  .put(protect, admin, updateRequest)
  .delete(protect, admin, deleteRequest);

module.exports = router;
