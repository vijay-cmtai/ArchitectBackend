const asyncHandler = require("express-async-handler");
const Product = require("../../models/productModel.js");

// @desc    Fetch all products
const getProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({}).populate("user", "name profession");
  res.json(products);
});

// @desc    Fetch a single product by ID
const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (product) {
    res.json(product);
  } else {
    res.status(404);
    throw new Error("Product not found");
  }
});

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
    youtubeLink, // ✨ Naya field get karein
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
    youtubeLink, // ✨ Naye field ko add karein
  });

  const createdProduct = await product.save();
  res.status(201).json(createdProduct);
});

// @desc    Update an existing product
const updateProduct = asyncHandler(async (req, res) => {
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
    status,
    direction,
    country,
    planType,
    youtubeLink, // ✨ Naya field get karein
  } = req.body;

  const product = await Product.findById(req.params.id);

  if (product) {
    if (
      product.user.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      res.status(401);
      throw new Error("Not authorized to update this product");
    }

    // Update all fields
    Object.assign(product, req.body);
    product.youtubeLink = youtubeLink || product.youtubeLink; // ✨ Naye field ko update karein

    // Update files if provided
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

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
