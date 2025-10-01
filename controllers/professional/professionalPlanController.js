const asyncHandler = require("express-async-handler");
const ProfessionalPlan = require("../../models/professionalPlanModel.js");

const normalizeToArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [value];
};

/**
 * @desc    Fetch all approved professional plans
 * @route   GET /api/professional-plans
 * @access  Public
 */
/**
 * @desc    Fetch all approved professional plans with pagination
 * @route   GET /api/professional-plans
 * @access  Public
 */
const getAllApprovedPlans = asyncHandler(async (req, res) => {
  const pageSize = Number(req.query.limit) || 12;
  const page = Number(req.query.pageNumber) || 1;

  // Search keyword
  const keyword = req.query.keyword
    ? {
        $or: [
          { name: { $regex: req.query.keyword, $options: "i" } },
          { description: { $regex: req.query.keyword, $options: "i" } },
          { productNo: { $regex: req.query.keyword, $options: "i" } },
        ],
      }
    : {};

  // Build query
  const query = {
    status: "Approved",
    ...keyword,
  };

  // Add filters if provided
  if (req.query.category && req.query.category !== "all") {
    query.category = req.query.category;
  }
  if (req.query.plotSize && req.query.plotSize !== "all") {
    query.plotSize = req.query.plotSize;
  }
  if (req.query.direction && req.query.direction !== "all") {
    query.direction = req.query.direction;
  }
  if (req.query.propertyType && req.query.propertyType !== "all") {
    query.propertyType = req.query.propertyType;
  }

  // Count total documents
  const count = await ProfessionalPlan.countDocuments(query);

  // Fetch plans with pagination
  const plans = await ProfessionalPlan.find(query)
    .populate("user", "name profession")
    .limit(pageSize)
    .skip(pageSize * (page - 1))
    .sort({ createdAt: -1 });

  // Return paginated response
  res.json({
    plans,
    page,
    pages: Math.ceil(count / pageSize),
  });
});

/**
 * @desc    Fetch plans for the logged-in professional
 * @route   GET /api/professional-plans/my-plans
 * @access  Private/Professional
 */
const getMyPlans = asyncHandler(async (req, res) => {
  const plans = await ProfessionalPlan.find({ user: req.user._id }).sort({
    createdAt: -1,
  });
  res.json(plans);
});

/**
 * @desc    Fetch a single plan by its ID
 * @route   GET /api/professional-plans/:id
 * @access  Public
 */
const getPlanById = asyncHandler(async (req, res) => {
  const plan = await ProfessionalPlan.findById(req.params.id)
    .populate("crossSellProducts", "name mainImage price salePrice isSale slug")
    .populate("upSellProducts", "name mainImage price salePrice isSale slug");

  if (plan) {
    res.json(plan);
  } else {
    res.status(404);
    throw new Error("Plan not found");
  }
});

/**
 * @desc    Fetch a single plan by its slug
 * @route   GET /api/professional-plans/slug/:slug
 * @access  Public
 */
const getPlanBySlug = asyncHandler(async (req, res) => {
  const slug = req.params.slug;
  // Extract the ID from the end of the slug
  const planId = slug.split("-").pop();

  // Basic validation for ObjectId
  if (!planId.match(/^[0-9a-fA-F]{24}$/)) {
    res.status(404);
    throw new Error("Plan not found (Invalid ID format)");
  }

  // Find the plan by the extracted ID
  const plan = await ProfessionalPlan.findById(planId)
    .populate("crossSellProducts", "name mainImage price salePrice isSale slug")
    .populate("upSellProducts", "name mainImage price salePrice isSale slug");

  if (plan) {
    res.json(plan);
  } else {
    res.status(404);
    throw new Error("Plan not found");
  }
});

/**
 * @desc    Create a new professional plan
 * @route   POST /api/professional-plans
 * @access  Private/Professional
 */
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
    isSale,
    city,
    productNo,
    contactName,
    contactEmail,
    contactPhone,
    seoTitle,
    seoDescription,
    seoKeywords,
    seoAltText,
    taxRate,
    crossSellProducts,
    upSellProducts,
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
    throw new Error("Please fill all required fields.");
  }

  if (!req.files || !req.files.mainImage || !req.files.planFile) {
    res.status(400);
    throw new Error("Main image and at least one plan file are required.");
  }

  const planExists = await ProfessionalPlan.findOne({ productNo });
  if (planExists) {
    res.status(400);
    throw new Error("A plan with this Product Number already exists.");
  }

  const planData = {
    ...req.body,
    user: req.user._id,
    country: normalizeToArray(country),
    category: normalizeToArray(category),
    city: Array.isArray(city) ? city[0] : city,
    isSale: isSale === "true" || isSale === true,
    status: "Pending Review", // New plans are always pending
  };

  const getFilePath = (file) => file.location || file.path;

  try {
    planData.mainImage = getFilePath(req.files.mainImage[0]);
    planData.planFile = req.files.planFile.map(getFilePath);
    planData.galleryImages = req.files.galleryImages
      ? req.files.galleryImages.map(getFilePath)
      : [];
    if (req.files.headerImage && req.files.headerImage[0]) {
      planData.headerImage = getFilePath(req.files.headerImage[0]);
    }
  } catch (error) {
    console.error("Error processing files:", error);
    res.status(400).send("Error processing uploaded files");
    return;
  }

  if (planType === "Construction Products") {
    planData.contactDetails = {
      name: contactName || "",
      email: contactEmail || "",
      phone: contactPhone || "",
    };
  }

  planData.seo = {
    title: seoTitle || name,
    description:
      seoDescription || (description ? description.substring(0, 160) : ""),
    keywords: seoKeywords || "",
    altText: seoAltText || name,
  };

  if (taxRate && !isNaN(taxRate)) planData.taxRate = Number(taxRate);

  planData.crossSellProducts = normalizeToArray(crossSellProducts);
  planData.upSellProducts = normalizeToArray(upSellProducts);

  try {
    const plan = new ProfessionalPlan(planData);
    const createdPlan = await plan.save();
    res.status(201).json(createdPlan);
  } catch (saveError) {
    console.error("Error saving plan:", saveError);
    res.status(400);
    throw new Error(`Failed to save plan: ${saveError.message}`);
  }
});

/**
 * @desc    Update an existing professional plan
 * @route   PUT /api/professional-plans/:id
 * @access  Private/Professional
 */
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
    res.status(401);
    throw new Error("Not authorized to update this plan");
  }

  if (productNo && plan.productNo !== productNo) {
    const planExists = await ProfessionalPlan.findOne({ productNo });
    if (planExists) {
      res.status(400);
      throw new Error("Another plan with this Product Number already exists.");
    }
  }

  Object.keys(req.body).forEach((key) => {
    const specialFields = [
      "country",
      "city",
      "category",
      "isSale",
      "crossSellProducts",
      "upSellProducts",
      "seoTitle",
      "seoDescription",
      "seoKeywords",
      "seoAltText",
      "contactName",
      "contactEmail",
      "contactPhone",
    ];
    if (!specialFields.includes(key)) {
      plan[key] = req.body[key];
    }
  });

  if (country !== undefined) plan.country = normalizeToArray(country);
  if (req.body.category !== undefined)
    plan.category = normalizeToArray(req.body.category);
  if (city !== undefined) plan.city = Array.isArray(city) ? city[0] : city;
  if (req.body.isSale !== undefined) {
    plan.isSale = req.body.isSale === "true" || req.body.isSale === true;
  }
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
  if (seoAltText !== undefined) plan.seo.altText = seoAltText;
  if (taxRate !== undefined) plan.taxRate = Number(taxRate);
  if (crossSellProducts !== undefined)
    plan.crossSellProducts = normalizeToArray(crossSellProducts);
  if (upSellProducts !== undefined)
    plan.upSellProducts = normalizeToArray(upSellProducts);

  if (req.files) {
    const getFilePath = (file) => file.location || file.path;
    if (req.files.mainImage)
      plan.mainImage = getFilePath(req.files.mainImage[0]);
    if (req.files.headerImage)
      plan.headerImage = getFilePath(req.files.headerImage[0]);
    if (req.files.galleryImages)
      plan.galleryImages = req.files.galleryImages.map(getFilePath);
    if (req.files.planFile) {
      const newPlanFiles = req.files.planFile.map(getFilePath);
      plan.planFile = [...(plan.planFile || []), ...newPlanFiles];
    }
  }

  const updatedPlan = await plan.save();
  res.json(updatedPlan);
});

/**
 * @desc    Delete a professional plan
 * @route   DELETE /api/professional-plans/:id
 * @access  Private/Professional
 */
const deletePlan = asyncHandler(async (req, res) => {
  const plan = await ProfessionalPlan.findById(req.params.id);
  if (plan) {
    if (plan.user.toString() !== req.user._id.toString()) {
      res.status(401);
      throw new Error("Not authorized to delete this plan");
    }
    await plan.deleteOne();
    res.json({ message: "Plan removed successfully" });
  } else {
    res.status(404);
    throw new Error("Plan not found");
  }
});

/**
 * @desc    Create a new review for a plan
 * @route   POST /api/professional-plans/:id/reviews
 * @access  Private
 */
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
  getPlanBySlug,
  createPlan,
  updatePlan,
  deletePlan,
  createPlanReview,
};
