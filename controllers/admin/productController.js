// controllers/admin/productController.js

const asyncHandler = require("express-async-handler");
const Product = require("../../models/productModel.js");

// @desc    Fetch all products
// @route   GET /api/products
// @access  Public
const getProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({}).populate("user", "name profession");
  res.json(products);
});

// @desc    Fetch a single product by ID, including its reviews
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
    description,
    plotSize,
    plotArea,
    rooms,
    bathrooms,
    kitchen,
    floors,
    price,
    salePrice,
    isSale,
    category,
    propertyType,
    direction,
    country,
    planType,
    youtubeLink,
  } = req.body;

  if (
    !name ||
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
    throw new Error("Main image and plan file are required");
  }

  const product = new Product({
    user: req.user._id,
    name,
    description,
    plotSize,
    plotArea: Number(plotArea),
    rooms: Number(rooms) || 0,
    bathrooms: Number(bathrooms) || 0,
    kitchen: Number(kitchen) || 0,
    floors: Number(floors) || 0,
    direction,
    country,
    planType,
    price: Number(price),
    salePrice: salePrice ? Number(salePrice) : 0,
    isSale: isSale === "true",
    category,
    propertyType,
    status: req.user.role === "admin" ? "Published" : "Pending Review",
    mainImage: req.files.mainImage[0].path,
    planFile: req.files.planFile[0].path,
    galleryImages: req.files.galleryImages
      ? req.files.galleryImages.map((file) => file.path)
      : [],
    youtubeLink,
  });

  const createdProduct = await product.save();
  res.status(201).json(createdProduct);
});

// @desc    Update an existing product
// @route   PUT /api/products/:id
// @access  Private/ProfessionalOrAdmin
const updateProduct = asyncHandler(async (req, res) => {
  const { youtubeLink } = req.body;
  const product = await Product.findById(req.params.id);

  if (product) {
    if (
      product.user.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      res.status(401);
      throw new Error("Not authorized to update this product");
    }

    Object.assign(product, req.body);
    product.youtubeLink = youtubeLink || product.youtubeLink;

    if (req.files) {
      if (req.files.mainImage) product.mainImage = req.files.mainImage[0].path;
      if (req.files.planFile) product.planFile = req.files.planFile[0].path;
      if (req.files.galleryImages)
        product.galleryImages = req.files.galleryImages.map(
          (file) => file.path
        );
    }

    const updatedProduct = await product.save();
    res.json(updatedProduct);
  } else {
    res.status(404);
    throw new Error("Product not found");
  }
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

// ==========================================================
// ✨ NEW FUNCTION TO ADD REVIEWS ✨
// ==========================================================
// @desc    Create a new review for a product
// @route   POST /api/products/:id/reviews
// @access  Private (for logged-in users)
const createProductReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;

  if (!rating || !comment) {
    res.status(400);
    throw new Error("Rating and comment are required");
  }

  const product = await Product.findById(req.params.id);

  if (product) {
    // Check if the user has already reviewed this product
    const alreadyReviewed = product.reviews.find(
      (r) => r.user.toString() === req.user._id.toString()
    );

    if (alreadyReviewed) {
      res.status(400);
      throw new Error("Product already reviewed by this user");
    }

    // Create the new review object
    const review = {
      name: req.user.name,
      rating: Number(rating),
      comment,
      user: req.user._id,
    };

    // Add the new review to the product's reviews array
    product.reviews.push(review);

    // The middleware in the model will automatically update numReviews and rating

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
  // ++ CHANGE HERE: Export the new function
  createProductReview,
};
