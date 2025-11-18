const express = require("express");
const router = express.Router();
const {
  createGalleryItems,
  getGalleryItems,
  deleteGalleryItem,
} = require("../controllers/galleryController.js");
const { protect, admin } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");
router
  .route("/")
  .get(getGalleryItems)
  .post(protect, admin, upload.array("images", 10), createGalleryItems);
router.route("/:id").delete(protect, admin, deleteGalleryItem);
module.exports = router;
