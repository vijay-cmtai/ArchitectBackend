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

router
  .route("/")
  .post(upload.single("referenceFile"), createCustomizationRequest)
  .get(protect, admin, getAllRequests);

router
  .route("/:id")
  .put(protect, admin, updateRequest)
  .delete(protect, admin, deleteRequest);

module.exports = router;
