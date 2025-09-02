const asyncHandler = require("express-async-handler");
const Product = require("../../models/productModel.js");

// @desc    Fetch all products
// @route   GET /api/products
// @access  Public
const getProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({}).populate("user", "name profession");
  res.json(products);
});

// @desc    Fetch a single product by ID
// @route   GET /api/products/:id
// @access  Public
const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (product) {
    res.json(product);
  } else {
    res.status(404);
    throw new Error("Product not found");
  }
});

// @desc    Create a new product
// @route   POST /api/products
// @access  Private/ProfessionalOrAdmin
const createProduct = asyncHandler(async (req, res) => {
  const {
    name,
    description, // Get description for SEO default
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
    // --- GET SEO FIELDS FROM REQUEST BODY ---
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

  const productExists = await Product.findOne({ productNo });
  if (productExists) {
    res.status(400);
    throw new Error("Product with this Product Number already exists.");
  }

  if (!req.files || !req.files.mainImage || !req.files.planFile) {
    res.status(400);
    throw new Error("Main image and at least one plan file are required");
  }

  const countryArray = country.split(",").map((c) => c.trim());
  const cityArray = city.split(",").map((c) => c.trim());
  const planFilesArray = req.files.planFile.map((file) => file.path);

  const productData = {
    ...req.body,
    user: req.user._id,
    country: countryArray,
    city: cityArray,
    isSale: isSale === "true",
    mainImage: req.files.mainImage[0].path,
    planFile: planFilesArray,
    galleryImages: req.files.galleryImages
      ? req.files.galleryImages.map((file) => file.path)
      : [],
    headerImage: req.files.headerImage
      ? req.files.headerImage[0].path
      : undefined,
    status: req.user.role === "admin" ? "Published" : "Pending Review",
  };

  // Add contact details if applicable
  if (planType === "Construction Products") {
    productData.contactDetails = {
      name: contactName,
      email: contactEmail,
      phone: contactPhone,
    };
  }

  // --- ADD SEO DATA TO THE NEW PRODUCT ---
  productData.seo = {
    title: seoTitle || name, // Default to product name if SEO title is empty
    description: seoDescription || description.substring(0, 160), // Default to first 160 chars of description
    keywords: seoKeywords || "",
  };

  const product = new Product(productData);
  const createdProduct = await product.save();
  res.status(201).json(createdProduct);
});

// @desc    Update an existing product
// @route   PUT /api/products/:id
// @access  Private/ProfessionalOrAdmin
const updateProduct = asyncHandler(async (req, res) => {
  const {
    country,
    city,
    productNo,
    contactName,
    contactEmail,
    contactPhone,
    // --- GET SEO FIELDS FROM REQUEST BODY ---
    seoTitle,
    seoDescription,
    seoKeywords,
  } = req.body;
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  if (
    product.user.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    res.status(401);
    throw new Error("Not authorized to update this product");
  }

  if (productNo && product.productNo !== productNo) {
    const productExists = await Product.findOne({ productNo });
    if (productExists) {
      res.status(400);
      throw new Error(
        "Another product with this Product Number already exists."
      );
    }
  }

  // Update all fields from req.body
  Object.assign(product, req.body);

  if (country) product.country = country.split(",").map((c) => c.trim());
  if (city) product.city = city.split(",").map((c) => c.trim());

  // Update contact details
  if (product.planType === "Construction Products") {
    if (!product.contactDetails) product.contactDetails = {};
    if (contactName !== undefined) product.contactDetails.name = contactName;
    if (contactEmail !== undefined) product.contactDetails.email = contactEmail;
    if (contactPhone !== undefined) product.contactDetails.phone = contactPhone;
  }

  // --- UPDATE SEO FIELDS IF THEY ARE PROVIDED ---
  if (!product.seo) product.seo = {}; // Ensure the seo object exists
  if (seoTitle !== undefined) product.seo.title = seoTitle;
  if (seoDescription !== undefined) product.seo.description = seoDescription;
  if (seoKeywords !== undefined) product.seo.keywords = seoKeywords;

  // Handle file updates
  if (req.files) {
    if (req.files.mainImage) product.mainImage = req.files.mainImage[0].path;
    if (req.files.headerImage)
      product.headerImage = req.files.headerImage[0].path;
    if (req.files.galleryImages)
      product.galleryImages = req.files.galleryImages.map((file) => file.path);
    if (req.files.planFile && req.files.planFile.length > 0) {
      const newPlanFiles = req.files.planFile.map((file) => file.path);
      product.planFile = [...product.planFile, ...newPlanFiles];
    }
  }

  const updatedProduct = await product.save();
  res.json(updatedProduct);
});

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/ProfessionalOrAdmin
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (product) {
    if (
      product.user.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      res.status(401);
      throw new Error("Not authorized to delete this product");
    }
    await product.deleteOne();
    res.json({ message: "Product removed successfully" });
  } else {
    res.status(404);
    throw new Error("Product not found");
  }
});

// @desc    Create a new review for a product
// @route   POST /api/products/:id/reviews
// @access  Private
const createProductReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;

  if (!rating || !comment) {
    res.status(400);
    throw new Error("Rating and comment are required");
  }

  const product = await Product.findById(req.params.id);

  if (product) {
    const alreadyReviewed = product.reviews.find(
      (r) => r.user.toString() === req.user._id.toString()
    );
    if (alreadyReviewed) {
      res.status(400);
      throw new Error("Product already reviewed by this user");
    }

    const review = {
      name: req.user.name,
      rating: Number(rating),
      comment,
      user: req.user._id,
    };
    product.reviews.push(review);
    await product.save();
    res.status(201).json({ message: "Review added successfully" });
  } else {
    res.status(404);
    throw new Error("Product not found");
  }
});

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  createProductReview,
};
