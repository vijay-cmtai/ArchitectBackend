const express = require("express");
const router = express.Router();
const {
  getAllApprovedPlans,
  getMyPlans,
  getPlanById,
  getPlanBySlug, // Import the new function
  createPlan,
  updatePlan,
  deletePlan,
  createPlanReview,
} = require("../controllers/professional/professionalPlanController.js");
const {
  protect,
  professionalProtect,
} = require("../middleware/authMiddleware.js");
const upload = require("../middleware/uploadMiddleware.js");

// Multer middleware for handling multiple file fields
const handleFileUploads = upload.fields([
  { name: "mainImage", maxCount: 1 },
  { name: "headerImage", maxCount: 1 },
  { name: "galleryImages", maxCount: 5 },
  { name: "planFile", maxCount: 10 },
]);

// Public route to get all approved plans
router.route("/").get(getAllApprovedPlans);

// Route to create a new plan (requires auth and file upload handling)
router
  .route("/")
  .post(protect, professionalProtect, handleFileUploads, createPlan);

// Route for professionals to see their own plans
router.route("/my-plans").get(protect, professionalProtect, getMyPlans);

// Public route to get a plan by slug (must be before /:id)
router.route("/slug/:slug").get(getPlanBySlug);

// Routes for a specific plan by ID
router
  .route("/:id")
  .get(getPlanById) // Public
  .put(protect, professionalProtect, handleFileUploads, updatePlan) // Private
  .delete(protect, professionalProtect, deletePlan); // Private

// Route to create a review for a plan
router.route("/:id/reviews").post(protect, createPlanReview);

module.exports = router;
