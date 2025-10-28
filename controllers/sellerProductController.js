const asyncHandler = require("express-async-handler");
const SellerProduct = require("../models/sellerProductModel.js");
const Brand = require("../models/brandModel.js");
const Category = require("../models/categoryModel.js");

const findOrCreate = async (model, name) => {
  if (!name) return;
  const doc = await model.findOne({
    name: { $regex: new RegExp(`^${name}$`, "i") },
  });
  if (!doc) {
    await model.create({ name });
  }
};

const createSellerProduct = asyncHandler(async (req, res) => {
  const { name, description, brand, category, price, salePrice, countInStock } =
    req.body;

  if (!name || !brand || !category || !price || countInStock === undefined) {
    res.status(400);
    throw new Error("Please fill all required fields");
  }

  if (!req.files || !req.files.image || req.files.image.length === 0) {
    res.status(400);
    throw new Error("Main product image is required.");
  }

  const mainImageUrl = req.files.image[0].location;
  const galleryImageUrls = req.files.images
    ? req.files.images.map((file) => file.location)
    : [];

  await findOrCreate(Brand, brand);
  await findOrCreate(Category, category);

  const product = new SellerProduct({
    seller: req.user._id,
    name,
    description,
    brand,
    category,
    price,
    salePrice: salePrice || 0,
    countInStock,
    image: mainImageUrl,
    images: galleryImageUrls,
    status: "Approved",
    isApproved: true,
  });

  const createdProduct = await product.save();
  res.status(201).json(createdProduct);
});

const getMyProducts = asyncHandler(async (req, res) => {
  const products = await SellerProduct.find({ seller: req.user._id }).sort({
    createdAt: -1,
  });
  res.json(products);
});

const updateMyProduct = asyncHandler(async (req, res) => {
  const { name, description, brand, category, price, salePrice, countInStock } =
    req.body;
  const product = await SellerProduct.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  if (product.seller.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error("You are not authorized to update this product.");
  }

  await findOrCreate(Brand, brand);
  await findOrCreate(Category, category);

  product.name = name || product.name;
  product.description = description || product.description;
  product.brand = brand || product.brand;
  product.category = category || product.category;
  product.price = price !== undefined ? price : product.price;
  product.salePrice = salePrice !== undefined ? salePrice : product.salePrice;
  product.countInStock =
    countInStock !== undefined ? countInStock : product.countInStock;

  if (req.files) {
    if (req.files.image && req.files.image.length > 0) {
      product.image = req.files.image[0].location;
    }
    if (req.files.images && req.files.images.length > 0) {
      product.images = req.files.images.map((file) => file.location);
    }
  }

  product.status = "Approved";
  product.isApproved = true;

  const updatedProduct = await product.save();
  res.json(updatedProduct);
});

const deleteMyProduct = asyncHandler(async (req, res) => {
  const product = await SellerProduct.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  if (product.seller.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error("You are not authorized to delete this product.");
  }

  await SellerProduct.deleteOne({ _id: req.params.id });
  res.json({ message: "Product removed successfully." });
});

// NAYE FUNCTIONS ISI FILE MEIN ADD KIYE GAYE HAIN
const getUniqueBrands = asyncHandler(async (req, res) => {
  const brands = await Brand.find({}).sort({ name: 1 });
  res.json(brands);
});

const getUniqueCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({}).sort({ name: 1 });
  res.json(categories);
});
const getAllPublicProducts = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 12; // Ek page par 12 products
  const page = parseInt(req.query.page, 10) || 1;

  const count = await SellerProduct.countDocuments({ isApproved: true });
  const products = await SellerProduct.find({ isApproved: true })
    .populate("seller", "businessName photoUrl") // photoUrl yahan se aayega
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(limit * (page - 1));

  res.json({
    products,
    page,
    pages: Math.ceil(count / limit),
    totalProducts: count,
  });
});

module.exports = {
  createSellerProduct,
  getMyProducts,
  updateMyProduct,
  deleteMyProduct,
  getUniqueBrands,
  getUniqueCategories,
  getAllPublicProducts,
};
