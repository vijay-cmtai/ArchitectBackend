// controllers/professionalPlanController.js

const asyncHandler = require("express-async-handler");
const ProfessionalPlan = require("../../models/professionalPlanModel.js");

const getAllApprovedPlans = asyncHandler(async (req, res) => {
  const plans = await ProfessionalPlan.find({
    status: { $in: ["Approved", "Published"] },
  }).populate("professional", "name profession");

  res.json(plans);
});

const getMyPlans = asyncHandler(async (req, res) => {
  const plans = await ProfessionalPlan.find({ professional: req.user._id });
  res.json(plans);
});

const getPlanById = asyncHandler(async (req, res) => {
  const plan = await ProfessionalPlan.findById(req.params.id).populate(
    "professional",
    "name profession"
  );
  if (plan) {
    res.json(plan);
  } else {
    res.status(404);
    throw new Error("Plan not found");
  }
});

const createPlan = asyncHandler(async (req, res) => {
  if (req.user.role !== "professional" || !req.user.isApproved) {
    res.status(403);
    throw new Error(
      "Access Denied. Only approved professionals can create plans."
    );
  }
  const { planName, price, category, plotSize, plotArea, country, planType } =
    req.body;
  if (
    !planName ||
    !price ||
    !category ||
    !plotSize ||
    !plotArea ||
    !country ||
    !planType
  ) {
    res.status(400);
    throw new Error("Please fill all required fields");
  }
  if (!req.files || !req.files.mainImage || !req.files.planFile) {
    res.status(400);
    throw new Error("A main image and a plan file are required");
  }

  const plan = new ProfessionalPlan({
    ...req.body,
    professional: req.user._id,
    status: "Published",
    mainImage: req.files.mainImage[0].path,
    planFile: req.files.planFile[0].path,
    galleryImages: req.files.galleryImages
      ? req.files.galleryImages.map((f) => f.path)
      : [],
  });

  const createdPlan = await plan.save();
  res.status(201).json(createdPlan);
});

const updatePlan = asyncHandler(async (req, res) => {
  const plan = await ProfessionalPlan.findById(req.params.id);
  if (!plan) {
    res.status(404);
    throw new Error("Plan not found");
  }
  if (plan.professional.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Not authorized to update this plan");
  }

  Object.assign(plan, req.body);

  if (req.files) {
    if (req.files.mainImage) plan.mainImage = req.files.mainImage[0].path;
    if (req.files.planFile) plan.planFile = req.files.planFile[0].path;
    if (req.files.galleryImages)
      plan.galleryImages = req.files.galleryImages.map((f) => f.path);
  }

  plan.status = "Published";

  const updatedPlan = await plan.save();
  res.json(updatedPlan);
});

const deletePlan = asyncHandler(async (req, res) => {
  const plan = await ProfessionalPlan.findById(req.params.id);
  if (!plan) {
    res.status(404);
    throw new Error("Plan not found");
  }
  if (plan.professional.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Not authorized to delete this plan");
  }
  await plan.deleteOne();
  res.json({ message: "Plan removed successfully" });
});

module.exports = {
  getAllApprovedPlans,
  getMyPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
};
