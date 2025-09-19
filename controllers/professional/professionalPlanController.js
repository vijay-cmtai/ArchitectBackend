// controllers/professionalPlanController.js

const asyncHandler = require("express-async-handler");
const ProfessionalPlan = require("../../models/professionalPlanModel.js");

// @desc    Get all approved plans for public view
const getAllApprovedPlans = asyncHandler(async (req, res) => {
  const plans = await ProfessionalPlan.find({ status: "Approved" }).populate(
    "user",
    "name profession"
  );
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

// @desc    Create a new plan (updated to be like createProduct)
const createPlan = asyncHandler(async (req, res) => {
  // Authorization check for professionals
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
    seoTitle,
    seoDescription,
    seoKeywords,
    seoAltText,
    taxRate,
    crossSellProducts,
    upSellProducts,
  } = req.body;

  // Essential fields validation
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
    throw new Error("Please fill all required fields");
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

  const getFilePath = (file) => file.location || file.path; // For S3 or local storage

  // Prepare data for the new plan
  const planData = {
    ...req.body,
    user: req.user._id,
    country: req.body.country.split(",").map((c) => c.trim()),
    city: req.body.city.split(",").map((c) => c.trim()),
    isSale: req.body.isSale === "true",
    mainImage: getFilePath(req.files.mainImage[0]),
    planFile: req.files.planFile.map((file) => getFilePath(file)),
    galleryImages: req.files.galleryImages
      ? req.files.galleryImages.map((file) => getFilePath(file))
      : [],
    headerImage: req.files.headerImage
      ? getFilePath(req.files.headerImage[0])
      : undefined,
    seo: {
      title: seoTitle || name,
      description: seoDescription || description.substring(0, 160),
      keywords: seoKeywords || "",
      altText: seoAltText || name,
    },
  };

  if (taxRate && !isNaN(taxRate)) planData.taxRate = Number(taxRate);

  if (crossSellProducts) {
    planData.crossSellProducts = crossSellProducts
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  }
  if (upSellProducts) {
    planData.upSellProducts = upSellProducts
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  }

  const plan = new ProfessionalPlan(planData);
  const createdPlan = await plan.save();
  res.status(201).json(createdPlan);
});

// @desc    Update a plan owned by the professional (updated to be like updateProduct)
const updatePlan = asyncHandler(async (req, res) => {
  const {
    productNo,
    seoTitle,
    seoDescription,
    seoKeywords,
    seoAltText,
    taxRate,
    crossSellProducts,
    upSellProducts,
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
      res.status(400);
      throw new Error("Another plan with this Product Number already exists.");
    }
  }

  // Update fields from req.body
  const fieldsToUpdate = [
    "name",
    "description",
    "price",
    "salePrice",
    "category",
    "plotSize",
    "plotArea",
    "rooms",
    "bathrooms",
    "kitchen",
    "floors",
    "youtubeLink",
    "productNo",
  ];
  fieldsToUpdate.forEach((field) => {
    if (req.body[field] !== undefined) {
      plan[field] = req.body[field];
    }
  });

  if (req.body.isSale !== undefined) {
    plan.isSale = req.body.isSale === "true";
  }

  // Handle SEO
  if (!plan.seo) plan.seo = {};
  if (seoTitle !== undefined) plan.seo.title = seoTitle;
  if (seoDescription !== undefined) plan.seo.description = seoDescription;
  if (seoKeywords !== undefined) plan.seo.keywords = seoKeywords;
  if (seoAltText !== undefined) plan.seo.altText = seoAltText;

  if (taxRate !== undefined) plan.taxRate = Number(taxRate);

  // Handle cross/up-sell
  if (crossSellProducts !== undefined)
    plan.crossSellProducts = crossSellProducts
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  if (upSellProducts !== undefined)
    plan.upSellProducts = upSellProducts
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

  // Handle file updates
  if (req.files) {
    const getFilePath = (file) => file.location || file.path;
    if (req.files.mainImage)
      plan.mainImage = getFilePath(req.files.mainImage[0]);
    if (req.files.headerImage)
      plan.headerImage = getFilePath(req.files.headerImage[0]);
    if (req.files.galleryImages)
      plan.galleryImages = req.files.galleryImages.map((file) =>
        getFilePath(file)
      );
    if (req.files.planFile && req.files.planFile.length > 0) {
      plan.planFile = [
        ...plan.planFile,
        ...req.files.planFile.map((file) => getFilePath(file)),
      ];
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
