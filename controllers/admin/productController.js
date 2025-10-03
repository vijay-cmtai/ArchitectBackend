const asyncHandler = require("express-async-handler");
const Product = require("../../models/productModel.js");
const axios = require("axios");

const VERCEL_BUILD_HOOK_URL =
  "https://api.vercel.com/v1/integrations/deploy/prj_BDZT8vFso7lzNhybAA18Uco9YjSo/bj2HCDWHCS";

const triggerVercelBuild = async () => {
  try {
    await axios.post(VERCEL_BUILD_HOOK_URL);
  } catch (error) {
    console.error("Error triggering Vercel build hook:", error.message);
  }
};

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

const getProducts = asyncHandler(async (req, res) => {
  const pageSize = parseInt(req.query.limit) || 12;
  const page = parseInt(req.query.pageNumber) || 1;

  const query = {};

  const {
    keyword,
    country,
    category,
    plotSize,
    plotArea,
    direction,
    floors,
    propertyType,
    budget,
  } = req.query;

  if (keyword) {
    query.name = { $regex: keyword, $options: "i" };
  }

  if (country) {
    query.country = country;
  }

  if (category && category !== "all") {
    query.category = category;
  }

  if (plotSize && plotSize !== "all") {
    query.plotSize = plotSize;
  }

  if (direction && direction !== "all") {
    query.direction = direction;
  }

  if (floors && floors !== "all") {
    if (floors === "3") {
      query.floors = { $gte: 3 };
    } else {
      query.floors = Number(floors);
    }
  }

  if (propertyType && propertyType !== "all") {
    query.propertyType = propertyType;
  }

  if (budget) {
    const [min, max] = budget.split("-").map(Number);
    if (!isNaN(min) && !isNaN(max)) {
      query.price = { $gte: min, $lte: max };
    }
  }

  if (plotArea && plotArea !== "all") {
    if (plotArea === "2000+") {
      query.plotArea = { $gte: 2000 };
    } else {
      const [minArea, maxArea] = plotArea.split("-").map(Number);
      if (!isNaN(minArea) && !isNaN(maxArea)) {
        query.plotArea = { $gte: minArea, $lte: maxArea };
      }
    }
  }

  const count = await Product.countDocuments(query);
  const products = await Product.find(query)
    .sort({ _id: -1 })
    .limit(pageSize)
    .skip(pageSize * (page - 1))
    .populate("user", "name profession");

  res.json({ products, page, pages: Math.ceil(count / pageSize) });
});

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

const getProductBySlug = asyncHandler(async (req, res) => {
  const slug = req.params.slug;
  const productId = slug.split("-").pop();

  const product = await Product.findById(productId)
    .populate("crossSellProducts", "name mainImage price salePrice isSale slug")
    .populate("upSellProducts", "name mainImage price salePrice isSale slug");

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

  const productExists = await Product.findOne({ productNo });
  if (productExists) {
    res.status(400);
    throw new Error("Product with this Product Number already exists.");
  }

  const productData = {
    ...req.body,
    user: req.user._id,
    country: normalizeToArray(country),
    category: normalizeToArray(category),
    city: Array.isArray(city) ? city[0] : city,
    isSale: isSale === "true" || isSale === true,
    status: req.user.role === "admin" ? "Published" : "Pending Review",
  };

  const getFilePath = (file) => file.location || file.path;

  try {
    productData.mainImage = getFilePath(req.files.mainImage[0]);
    productData.planFile = req.files.planFile.map(getFilePath);
    productData.galleryImages = req.files.galleryImages
      ? req.files.galleryImages.map(getFilePath)
      : [];
    if (req.files.headerImage && req.files.headerImage[0]) {
      productData.headerImage = getFilePath(req.files.headerImage[0]);
    }
  } catch (error) {
    console.error("Error processing files:", error);
    res.status(400).send("Error processing uploaded files");
    return;
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

  productData.crossSellProducts = normalizeToArray(crossSellProducts);
  productData.upSellProducts = normalizeToArray(upSellProducts);

  try {
    const product = new Product(productData);
    const createdProduct = await product.save();
    await triggerVercelBuild();
    res.status(201).json(createdProduct);
  } catch (saveError) {
    console.error("Error saving product:", saveError);
    res.status(400);
    throw new Error(`Failed to save product: ${saveError.message}`);
  }
});

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
    req.user.role !== "admin" &&
    (!product.user || product.user.toString() !== req.user._id.toString())
  ) {
    res.status(401);
    throw new Error("Not authorized to update this product");
  }

  if (productNo && product.productNo !== productNo) {
    const productExists = await Product.findOne({ productNo });
    if (
      productExists &&
      productExists._id.toString() !== product._id.toString()
    ) {
      res.status(400);
      throw new Error(
        "Another product with this Product Number already exists."
      );
    }
  }

  // --- START: FIX FOR VALIDATION ERRORS ---
  // Sanitize (clean) incoming data before processing it.
  Object.keys(req.body).forEach((key) => {
    const numericFields = [
      "kitchen",
      "bathrooms",
      "floors",
      "rooms",
      "plotArea",
      "price",
      "salePrice",
      "taxRate",
    ];

    // For numeric fields, if the value is empty or invalid, set it to undefined so Mongoose ignores it.
    if (numericFields.includes(key)) {
      const value = req.body[key];
      // If value is not an empty string, try to convert it. Otherwise, it's undefined.
      const numValue =
        value !== "" && value !== null ? Number(value) : undefined;
      req.body[key] = isNaN(numValue) ? undefined : numValue;
    }

    // For direction, if it's an empty string, set it to undefined to avoid enum error.
    if (key === "direction" && req.body[key] === "") {
      req.body[key] = undefined;
    }
  });
  // --- END: FIX ---

  // Update standard fields and their legacy counterparts from JSON/CSV
  Object.keys(req.body).forEach((key) => {
    const value = req.body[key];

    // Skip updating if the value is undefined
    if (value === undefined) return;

    // Standard field assignment
    product[key] = value;

    // Mapping to legacy (JSON/CSV) fields
    switch (key) {
      case "name":
        product.Name = value;
        break;
      case "description":
        product.Description = value;
        product["Short description"] = value;
        break;
      case "productNo":
        product.SKU = value;
        break;
      case "price":
        product["Regular price"] = Number(value);
        break;
      case "salePrice":
        product["Sale price"] = Number(value) || undefined;
        break;
      case "plotSize":
        product["Attribute 1 value(s)"] = value;
        break;
      case "plotArea":
        product["Attribute 2 value(s)"] = `${value} sqft`;
        break;
      case "rooms":
        product["Attribute 3 value(s)"] = value;
        break;
      case "direction":
        product["Attribute 4 value(s)"] = value;
        break;
      case "floors":
        product["Attribute 5 value(s)"] = value;
        break;
    }
  });

  // Handle fields that need special processing (like arrays, booleans)
  if (country !== undefined) {
    product.country = normalizeToArray(country);
  }
  if (req.body.category !== undefined) {
    const normalizedCategories = normalizeToArray(req.body.category);
    product.category = normalizedCategories;
    product.Categories = normalizedCategories.join(", ");
  }
  if (city !== undefined) {
    product.city = Array.isArray(city) ? city[0] : city;
  }

  if (req.body.isSale !== undefined) {
    const isSaleBool = req.body.isSale === "true" || req.body.isSale === true;
    product.isSale = isSaleBool;
    product["Is featured?"] = isSaleBool ? 1 : 0;
  }

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

  if (taxRate !== undefined) {
    const tax = Number(taxRate);
    if (!isNaN(tax)) {
      product.taxRate = tax;
      product["Tax class"] = tax;
    }
  }

  if (crossSellProducts !== undefined) {
    product.crossSellProducts = normalizeToArray(crossSellProducts);
    product["Cross-sells"] = normalizeToArray(crossSellProducts)
      .map((id) => `id:${id}`)
      .join(",");
  }
  if (upSellProducts !== undefined) {
    product.upSellProducts = normalizeToArray(upSellProducts);
    product.Upsells = normalizeToArray(upSellProducts)
      .map((id) => `id:${id}`)
      .join(",");
  }

  if (req.files) {
    const getFilePath = (file) => file.location || file.path;
    if (req.files.mainImage) {
      product.mainImage = getFilePath(req.files.mainImage[0]);
      product.Images = getFilePath(req.files.mainImage[0]);
    }
    if (req.files.headerImage) {
      product.headerImage = getFilePath(req.files.headerImage[0]);
    }
    if (req.files.galleryImages) {
      product.galleryImages = req.files.galleryImages.map(getFilePath);
    }
    if (req.files.planFile) {
      const newPlanFiles = req.files.planFile.map(getFilePath);
      product.planFile = [...(product.planFile || []), ...newPlanFiles];
    }
  }

  const updatedProduct = await product.save();
  await triggerVercelBuild();
  res.json(updatedProduct);
});

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
    await triggerVercelBuild();
    res.json({ message: "Product removed successfully" });
  } else {
    res.status(404);
    throw new Error("Product not found");
  }
});

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
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  createProductReview,
};
