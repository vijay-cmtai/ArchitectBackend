const asyncHandler = require("express-async-handler");
const Product = require("../../models/productModel.js");

// @desc    Fetch all products
const getProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({}).populate("user", "name profession");
  res.json(products);
});

// @desc    Fetch a single product by ID (now populates related products)
const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate("crossSellProducts", "name mainImage price salePrice isSale slug")
    .populate("upSellProducts", "name mainImage price salePrice isSale slug");

  if (product) {
    res.json(product);
  } else {
    res.status(404);
    throw new Error("Product not found");
  }
});

// @desc    Create a new product
const createProduct = asyncHandler(async (req, res) => {
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

  console.log("Received files:", req.files);
  console.log("Request body:", req.body);

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

  if (!req.files) {
    res.status(400);
    throw new Error("No files uploaded");
  }

  if (!req.files.mainImage || !req.files.mainImage[0]) {
    res.status(400);
    throw new Error("Main image is required");
  }

  if (!req.files.planFile || req.files.planFile.length === 0) {
    res.status(400);
    throw new Error("At least one plan file is required");
  }

  const productExists = await Product.findOne({ productNo });
  if (productExists) {
    res.status(400);
    throw new Error("Product with this Product Number already exists.");
  }

  const countryArray = country.split(",").map((c) => c.trim());
  const cityArray = city.split(",").map((c) => c.trim());

  const productData = {
    ...req.body,
    user: req.user._id,
    country: countryArray,
    city: cityArray,
    isSale: isSale === "true" || isSale === true,
    status: req.user.role === "admin" ? "Published" : "Pending Review",
  };

  const getFilePath = (file) => file.location || file.path;

  try {
    productData.mainImage = getFilePath(req.files.mainImage[0]);
    productData.planFile = req.files.planFile.map((file) => getFilePath(file));

    if (req.files.galleryImages && req.files.galleryImages.length > 0) {
      productData.galleryImages = req.files.galleryImages.map((file) =>
        getFilePath(file)
      );
    } else {
      productData.galleryImages = [];
    }

    if (req.files.headerImage && req.files.headerImage[0]) {
      productData.headerImage = getFilePath(req.files.headerImage[0]);
    }
  } catch (error) {
    console.error("Error processing files:", error);
    res.status(400);
    throw new Error("Error processing uploaded files");
  }

  if (planType === "Construction Products") {
    productData.contactDetails = {
      name: contactName || "",
      email: contactEmail || "",
      phone: contactPhone || "",
    };
  }

  productData.seo = {
    title: seoTitle || name,
    description:
      seoDescription || (description ? description.substring(0, 160) : ""),
    keywords: seoKeywords || "",
    altText: seoAltText || name,
  };

  if (taxRate && !isNaN(taxRate)) productData.taxRate = Number(taxRate);

  if (crossSellProducts) {
    productData.crossSellProducts = crossSellProducts
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  }

  if (upSellProducts) {
    productData.upSellProducts = upSellProducts
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  }

  console.log("Final product data:", {
    ...productData,
    description: productData.description
      ? productData.description.substring(0, 100) + "..."
      : "No description",
  });

  try {
    const product = new Product(productData);
    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
  } catch (saveError) {
    console.error("Error saving product:", saveError);
    res.status(400);
    throw new Error(`Failed to save product: ${saveError.message}`);
  }
});

// @desc    Update an existing product
const updateProduct = asyncHandler(async (req, res) => {
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

  Object.assign(product, req.body);
  if (country) product.country = country.split(",").map((c) => c.trim());
  if (city) product.city = city.split(",").map((c) => c.trim());

  if (product.planType === "Construction Products") {
    if (!product.contactDetails) product.contactDetails = {};
    if (contactName !== undefined) product.contactDetails.name = contactName;
    if (contactEmail !== undefined) product.contactDetails.email = contactEmail;
    if (contactPhone !== undefined) product.contactDetails.phone = contactPhone;
  }

  if (!product.seo) product.seo = {};
  if (seoTitle !== undefined) product.seo.title = seoTitle;
  if (seoDescription !== undefined) product.seo.description = seoDescription;
  if (seoKeywords !== undefined) product.seo.keywords = seoKeywords;
  if (seoAltText !== undefined) product.seo.altText = seoAltText;

  if (taxRate !== undefined) product.taxRate = Number(taxRate);
  if (crossSellProducts !== undefined)
    product.crossSellProducts = crossSellProducts
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  if (upSellProducts !== undefined)
    product.upSellProducts = upSellProducts
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

  if (req.files) {
    const getFilePath = (file) => file.location || file.path;

    if (req.files.mainImage && req.files.mainImage[0]) {
      product.mainImage = getFilePath(req.files.mainImage[0]);
    }
    if (req.files.headerImage && req.files.headerImage[0]) {
      product.headerImage = getFilePath(req.files.headerImage[0]);
    }
    if (req.files.galleryImages && req.files.galleryImages.length > 0) {
      product.galleryImages = req.files.galleryImages.map((file) =>
        getFilePath(file)
      );
    }
    if (req.files.planFile && req.files.planFile.length > 0) {
      const newPlanFiles = req.files.planFile.map((file) => getFilePath(file));
      product.planFile = [...(product.planFile || []), ...newPlanFiles];
    }
  }

  const updatedProduct = await product.save();
  res.json(updatedProduct);
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

// @desc    Create a new review for a product
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
