const express = require("express");
const router = express.Router();
const {
  createStandardRequest,
  getAllStandardRequests,
  updateStandardRequest,
  deleteStandardRequest,
} = require("../controllers/standardRequestController.js");
const { protect, admin } = require("../middleware/authMiddleware.js");
router
  .route("/")
  .post(createStandardRequest)
  .get(protect, admin, getAllStandardRequests);
router
  .route("/:id")
  .put(protect, admin, updateStandardRequest)
  .delete(protect, admin, deleteStandardRequest);
module.exports = router;
