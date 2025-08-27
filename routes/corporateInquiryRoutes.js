const express = require("express");
const router = express.Router();
const {
  submitInquiry,
  getAllInquiries,
  getInquiryById,
  updateInquiry,
  deleteInquiry,
} = require("../controllers/corporateInquiryController.js");
const { protect, admin } = require("../middleware/authMiddleware.js");
const upload = require("../middleware/uploadMiddleware.js"); 

router.route("/").post(upload.single("projectBrief"), submitInquiry);

router.route("/").get(protect, admin, getAllInquiries);

router
  .route("/:id")
  .get(protect, admin, getInquiryById)
  .put(protect, admin, updateInquiry)
  .delete(protect, admin, deleteInquiry);

module.exports = router;
