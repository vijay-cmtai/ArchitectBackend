// routes/blogRoutes.js

const express = require("express");
const router = express.Router();
const {
  getPublishedPosts,
  getPostBySlug,
  getAllPostsAdmin,
  createPost,
  updatePost,
  deletePost,
} = require("../controllers/blogPostController.js");
const { protect, admin } = require("../middleware/authMiddleware.js");
const upload = require("../middleware/uploadMiddleware.js");

// --- Public Routes ---
router.route("/").get(getPublishedPosts);
router.route("/slug/:slug").get(getPostBySlug); // Changed to avoid conflict with ID

// --- Admin Routes ---
router.route("/all").get(protect, admin, getAllPostsAdmin);
router.route("/").post(protect, admin, upload.single("mainImage"), createPost);
router
  .route("/:id")
  .put(protect, admin, upload.single("mainImage"), updatePost)
  .delete(protect, admin, deletePost);

module.exports = router;
