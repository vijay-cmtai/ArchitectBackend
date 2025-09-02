// routes/videoRoutes.js
const express = require("express");
const router = express.Router();
const {
  addVideoLink, // Yahan naam update kiya hai
  getVideos,
  getUniqueTopics,
  deleteVideo,
} = require("../controllers/admin/videoController.js"); // Path check kar lein
const { protect, admin } = require("../middleware/authMiddleware.js");

router.get("/topics", getUniqueTopics);

router
  .route("/")
  .post(protect, admin, addVideoLink) // Yahan bhi naam update kiya hai
  .get(getVideos);

router.route("/:id").delete(protect, admin, deleteVideo);

module.exports = router;
