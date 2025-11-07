const express = require("express");
const router = express.Router();
const {
  getUnreadCounts,
  getNotifications,
  markAsRead,
} = require("../controllers/notificationController");
const { protect, admin } = require("../middleware/authMiddleware");
router.route("/counts").get(protect, admin, getUnreadCounts);
router.route("/").get(protect, admin, getNotifications);
router.route("/:id/read").put(protect, admin, markAsRead);

module.exports = router;

