const asyncHandler = require("express-async-handler");
const ProfessionalPlan = require("../../models/professionalPlanModel.js");

// @desc    Get all approved plans for public view
// @route   GET /api/professional-plans
// @access  Public
const getAllApprovedPlans = asyncHandler(async (req, res) => {
  const plans = await ProfessionalPlan.find({
    status: { $in: ["Approved", "Published"] },
  }).populate("professional", "name profession");

  res.json(plans);
});

// @desc    Get plans created by the logged-in professional
// @route   GET /api/professional-plans/my-plans
// @access  Private/Professional
const getMyPlans = asyncHandler(async (req, res) => {
  const plans = await ProfessionalPlan.find({ professional: req.user._id });
  res.json(plans);
});

// @desc    Get a single plan by its ID
// @route   GET /api/professional-plans/:id
// @access  Public
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

// @desc    Create a new plan
// @route   POST /api/professional-plans
// @access  Private/Professional
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

// @desc    Update a plan owned by the professional
// @route   PUT /api/professional-plans/:id
// @access  Private/Professional
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

// @desc    Delete a plan owned by the professional
// @route   DELETE /api/professional-plans/:id
// @access  Private/Professional
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

// @desc    Create a new review for a professional plan
// @route   POST /api/professional-plans/:id/reviews
// @access  Private (for logged-in users)
const createPlanReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;

  if (!rating || !comment) {
    res.status(400);
    throw new Error("Rating and comment are required");
  }

  const plan = await ProfessionalPlan.findById(req.params.id);

  if (plan) {
    // Check if the user has already reviewed this plan
    const alreadyReviewed = plan.reviews.find(
      (r) => r.user.toString() === req.user._id.toString()
    );

    if (alreadyReviewed) {
      res.status(400);
      throw new Error("Plan already reviewed by this user");
    }

    // Create the new review object
    const review = {
      name: req.user.name,
      rating: Number(rating),
      comment,
      user: req.user._id,
    };

    // Add the new review to the plan's reviews array
    plan.reviews.push(review);

    await plan.save();
    res.status(201).json({ message: "Review added successfully" });
  } else {
    res.status(404);
    throw new Error("Plan not found");
  }
});

module.exports = {
  getAllApprovedPlans,
  getMyPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  createPlanReview,
};
