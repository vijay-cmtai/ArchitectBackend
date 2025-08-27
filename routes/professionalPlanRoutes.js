const express = require("express");
const router = express.Router();
const {
  getAllApprovedPlans, // Naya function import karein
  getMyPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
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

// ✨ NAYE ROUTES KA STRUCTURE ✨
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

module.exports = router;
