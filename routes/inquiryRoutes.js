const express = require("express");
const {
  createInquiry,
  getAllInquiries,
  updateInquiryStatus,
  deleteInquiry,
} = require("../controllers/inquiryController.js");
const { protect, admin } = require("../middleware/authMiddleware.js");

const router = express.Router();

router.route("/").post(createInquiry);

router.route("/").get(protect, admin, getAllInquiries);
router.route("/:id/status").put(protect, admin, updateInquiryStatus);
router.route("/:id").delete(protect, admin, deleteInquiry);

module.exports = router;
