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
  const pageSize = 12; // एक पेज पर कितने प्रोडक्ट्स दिखाने हैं
  const page = Number(req.query.pageNumber) || 1; // कौनसा पेज दिखाना है (URL से आएगा)

  const keyword = req.query.keyword
    ? {
        name: {
          $regex: req.query.keyword,
          $options: "i", // केस-इनसेंसिटिव सर्च
        },
      }
    : {};

  const count = await Product.countDocuments({ ...keyword });
  const products = await Product.find({ ...keyword })
    .populate("user", "name profession")
    .limit(pageSize) 
    .skip(pageSize * (page - 1));

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
      product[key] = req.body[key];
    }
  });

  if (country !== undefined) product.country = normalizeToArray(country);
  if (req.body.category !== undefined)
    product.category = normalizeToArray(req.body.category);
  if (city !== undefined) product.city = Array.isArray(city) ? city[0] : city;

  if (req.body.isSale !== undefined) {
    product.isSale = req.body.isSale === "true" || req.body.isSale === true;
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

  if (taxRate !== undefined) product.taxRate = Number(taxRate);

  if (crossSellProducts !== undefined)
    product.crossSellProducts = normalizeToArray(crossSellProducts);
  if (upSellProducts !== undefined)
    product.upSellProducts = normalizeToArray(upSellProducts);

  if (req.files) {
    const getFilePath = (file) => file.location || file.path;
    if (req.files.mainImage)
      product.mainImage = getFilePath(req.files.mainImage[0]);
    if (req.files.headerImage)
      product.headerImage = getFilePath(req.files.headerImage[0]);
    if (req.files.galleryImages)
      product.galleryImages = req.files.galleryImages.map(getFilePath);
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
