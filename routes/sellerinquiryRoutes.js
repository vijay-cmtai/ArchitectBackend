const express = require("express");
const router = express.Router();
const {
  createInquiry,
  getMyInquiries,
  getAllInquiries,
  getInquiryById,
  updateInquiryStatus,
} = require("../controllers/sellerinquiryController.js");
const {
  protect,
  sellerProtect,
  admin,
} = require("../middleware/authMiddleware.js");

const canAccess = (req, res, next) => {
  if (req.user && (req.user.role === "seller" || req.user.role === "admin")) {
    next();
  } else {
    res.status(401);
    throw new Error("Not authorized for this action");
  }
};
router.route("/").post(createInquiry);
// Seller Only
router.route("/my").get(protect, sellerProtect, getMyInquiries);
router.route("/all").get(protect, admin, getAllInquiries);
router.route("/:id").get(protect, canAccess, getInquiryById);
router.route("/:id/status").put(protect, canAccess, updateInquiryStatus);

module.exports = router;
