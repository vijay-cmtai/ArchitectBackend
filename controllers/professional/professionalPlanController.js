const asyncHandler = require("express-async-handler");
const ProfessionalPlan = require("../../models/professionalPlanModel.js");

// @desc    Get all approved plans for public view
const getAllApprovedPlans = asyncHandler(async (req, res) => {
  const plans = await ProfessionalPlan.find({
    status: { $in: ["Approved", "Published"] },
  }).populate("user", "name profession");
  res.json(plans);
});

// @desc    Get plans created by the logged-in professional
const getMyPlans = asyncHandler(async (req, res) => {
  const plans = await ProfessionalPlan.find({ user: req.user._id });
  res.json(plans);
});

// @desc    Get a single plan by its ID
const getPlanById = asyncHandler(async (req, res) => {
  const plan = await ProfessionalPlan.findById(req.params.id).populate(
    "user",
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
const createPlan = asyncHandler(async (req, res) => {
  if (req.user.role !== "professional" || !req.user.isApproved) {
    res.status(403);
    throw new Error(
      "Access Denied. Only approved professionals can create plans."
    );
  }

  const {
    name,
    description,
    price,
    category,
    plotSize,
    plotArea,
    country,
    planType,
    city,
    productNo,
    contactName,
    contactEmail,
    contactPhone,
    seoTitle,
    seoDescription,
    seoKeywords,
  } = req.body;

  if (
    !name ||
    !price ||
    !category ||
    !plotSize ||
    !plotArea ||
    !country ||
    !planType ||
    !city ||
    !productNo
  ) {
    res.status(400);
    throw new Error(
      "Please fill all required fields, including city and product number"
    );
  }

  const planExists = await ProfessionalPlan.findOne({ productNo });
  if (planExists) {
    res.status(400);
    throw new Error("A plan with this Product Number already exists.");
  }

  if (!req.files || !req.files.mainImage || !req.files.planFile) {
    res.status(400);
    throw new Error("Main image and at least one plan file are required");
  }

  const countryArray = country.split(",").map((c) => c.trim());
  const cityArray = city.split(",").map((c) => c.trim());
  const planFilesArray = req.files.planFile.map((file) => file.path);

  const planData = {
    ...req.body,
    user: req.user._id,
    name,
    country: countryArray,
    city: cityArray,
    isSale: req.body.isSale === "true",
    mainImage: req.files.mainImage[0].path,
    planFile: planFilesArray,
    galleryImages: req.files.galleryImages
      ? req.files.galleryImages.map((file) => file.path)
      : [],
    headerImage: req.files.headerImage
      ? req.files.headerImage[0].path
      : undefined,
  };

  if (planType === "Construction Products") {
    planData.contactDetails = {
      name: contactName,
      email: contactEmail,
      phone: contactPhone,
    };
  }

  planData.seo = {
    title: seoTitle || name,
    description: seoDescription || description.substring(0, 160),
    keywords: seoKeywords || "",
  };

  const plan = new ProfessionalPlan(planData);
  const createdPlan = await plan.save();
  res.status(201).json(createdPlan);
});

// @desc    Update a plan owned by the professional
const updatePlan = asyncHandler(async (req, res) => {
  const {
    country,
    city,
    productNo,
    contactName,
    contactEmail,
    contactPhone,
    seoTitle,
    seoDescription,
    seoKeywords,
  } = req.body;
  const plan = await ProfessionalPlan.findById(req.params.id);

  if (!plan) {
    res.status(404);
    throw new Error("Plan not found");
  }
  if (plan.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Not authorized to update this plan");
  }

  if (productNo && plan.productNo !== productNo) {
    const planExists = await ProfessionalPlan.findOne({ productNo });
    if (planExists) {
      res
        .status(400)
        .throw(
          new Error("Another plan with this Product Number already exists.")
        );
    }
  }

  Object.assign(plan, req.body);

  if (req.body.name) plan.name = req.body.name;
  if (country) plan.country = country.split(",").map((c) => c.trim());
  if (city) plan.city = city.split(",").map((c) => c.trim());

  if (plan.planType === "Construction Products") {
    if (!plan.contactDetails) plan.contactDetails = {};
    if (contactName !== undefined) plan.contactDetails.name = contactName;
    if (contactEmail !== undefined) plan.contactDetails.email = contactEmail;
    if (contactPhone !== undefined) plan.contactDetails.phone = contactPhone;
  }

  if (!plan.seo) plan.seo = {};
  if (seoTitle !== undefined) plan.seo.title = seoTitle;
  if (seoDescription !== undefined) plan.seo.description = seoDescription;
  if (seoKeywords !== undefined) plan.seo.keywords = seoKeywords;

  if (req.files) {
    if (req.files.mainImage) plan.mainImage = req.files.mainImage[0].path;
    if (req.files.headerImage) plan.headerImage = req.files.headerImage[0].path;
    if (req.files.galleryImages)
      plan.galleryImages = req.files.galleryImages.map((file) => file.path);
    if (req.files.planFile && req.files.planFile.length > 0) {
      const newPlanFiles = req.files.planFile.map((file) => file.path);
      plan.planFile = [...plan.planFile, ...newPlanFiles];
    }
  }

  const updatedPlan = await plan.save();
  res.json(updatedPlan);
});

// @desc    Delete a plan owned by the professional
const deletePlan = asyncHandler(async (req, res) => {
  const plan = await ProfessionalPlan.findById(req.params.id);
  if (!plan) {
    res.status(404);
    throw new Error("Plan not found");
  }
  if (plan.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Not authorized to delete this plan");
  }
  await plan.deleteOne();
  res.json({ message: "Plan removed successfully" });
});

// @desc    Create a new review for a professional plan
const createPlanReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  if (!rating || !comment) {
    res.status(400);
    throw new Error("Rating and comment are required");
  }
  const plan = await ProfessionalPlan.findById(req.params.id);
  if (plan) {
    const alreadyReviewed = plan.reviews.find(
      (r) => r.user.toString() === req.user._id.toString()
    );
    if (alreadyReviewed) {
      res.status(400);
      throw new Error("Plan already reviewed by this user");
    }
    const review = {
      name: req.user.name,
      rating: Number(rating),
      comment,
      user: req.user._id,
    };
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
