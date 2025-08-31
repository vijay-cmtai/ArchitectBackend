// routes/professionalPlanRoutes.js

const express = require("express");
const router = express.Router();
const {
  getAllApprovedPlans,
  getMyPlans,
  getPlanById,
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

const handleFileUploads = upload.fields([
  { name: "mainImage", maxCount: 1 },
  { name: "galleryImages", maxCount: 5 },
  { name: "planFile", maxCount: 1 },
]);

router
  .route("/")
  .get(getAllApprovedPlans)
  .post(protect, professionalProtect, handleFileUploads, createPlan);

router.route("/my-plans").get(protect, professionalProtect, getMyPlans);

router
  .route("/:id")
  .get(getPlanById)
  .put(protect, professionalProtect, handleFileUploads, updatePlan)
  .delete(protect, professionalProtect, deletePlan);
router.route("/:id/reviews").post(protect, createPlanReview);

module.exports = router;
