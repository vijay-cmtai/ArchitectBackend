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

  let query = {};

  const {
    searchTerm,
    country,
    category,
    plotSize,
    plotArea,
    direction,
    floors,
    propertyType,
    budget,
    sortBy,
    planCategory,
  } = req.query;

  if (planCategory) {
    let categoryQuery;
    const lowerCasePlanCategory = planCategory.toLowerCase();

    if (lowerCasePlanCategory === "floor-plans") {
      categoryQuery = {
        $or: [
          { planType: { $regex: /^Floor Plans$/i } },
          { category: { $regex: /^Floor Plans$/i } },
          { Categories: { $regex: /floor-plans/i } },
        ],
      };
    } else if (lowerCasePlanCategory === "elevations") {
      categoryQuery = {
        $or: [
          { planType: { $regex: /Floor Plans.*\+.*3 ?D.*Elevation/i } },
          { category: { $regex: /FLOOR PLAN.*\+.*ELEVATION/i } },
          { Categories: { $regex: /FLOOR PLAN.*\+.*ELEVATION/i } },
        ],
      };
    } else if (lowerCasePlanCategory === "interior-designs") {
      categoryQuery = {
        $or: [
          { planType: { $regex: /Interior Designs/i } },
          { category: { $regex: /Interior Designs/i } },
          { Categories: { $regex: /INTERIOR DESIGNS/i } },
        ],
      };
    } else if (lowerCasePlanCategory === "downloads") {
      categoryQuery = {
        planType: { $regex: /^Downloads$/i },
      };
    }

    if (categoryQuery) {
      query = { $and: [categoryQuery] };
    }
  }

  const otherFilters = {};

  if (searchTerm) {
    const searchRegex = { $regex: searchTerm, $options: "i" };
    otherFilters.$or = [
      { name: searchRegex },
      { Name: searchRegex },
      { description: searchRegex },
      { Description: searchRegex },
      { city: searchRegex },
      { productNo: searchRegex },
      { SKU: searchRegex },
    ];
  }

  if (country) otherFilters.country = country;
  if (category && category !== "all") otherFilters.category = category;
  if (plotSize && plotSize !== "all") otherFilters.plotSize = plotSize;
  if (direction && direction !== "all") otherFilters.direction = direction;
  if (propertyType && propertyType !== "all")
    otherFilters.propertyType = propertyType;

  if (floors && floors !== "all") {
    if (floors === "3") {
      otherFilters.floors = { $gte: 3 };
    } else {
      otherFilters.floors = Number(floors);
    }
  }

  if (budget) {
    const [min, max] = budget.split("-").map(Number);
    if (!isNaN(min) && !isNaN(max)) {
      otherFilters.price = { $gte: min, $lte: max };
    }
  }

  if (plotArea && plotArea !== "all") {
    if (plotArea === "2000+") {
      otherFilters.plotArea = { $gte: 2000 };
    } else {
      const [minArea, maxArea] = plotArea.split("-").map(Number);
      if (!isNaN(minArea) && !isNaN(maxArea)) {
        otherFilters.plotArea = { $gte: minArea, $lte: maxArea };
      }
    }
  }

  if (Object.keys(otherFilters).length > 0) {
    if (query.$and) {
      query.$and.push(otherFilters);
    } else {
      query = { ...query, ...otherFilters };
    }
  }

  let sortOptions = { _id: -1 };
  if (sortBy === "price-low") sortOptions = { price: 1 };
  if (sortBy === "price-high") sortOptions = { price: -1 };

  const count = await Product.countDocuments(query);
  const products = await Product.find(query)
    .sort(sortOptions)
    .limit(pageSize)
    .skip(pageSize * (page - 1))
    .populate("user", "name profession");

  res.json({ products, page, pages: Math.ceil(count / pageSize), count });
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
    crossSellProducts,
    upSellProducts,
  } = req.body;

  if (!name || !price || !productNo) {
    res.status(400);
    throw new Error(
      "Please fill required fields: Name, Price, and Product No."
    );
  }

  if (!req.files || !req.files.mainImage || req.files.mainImage.length === 0) {
    res.status(400);
    throw new Error("Main image is required.");
  }

  const numericFields = [
    "plotArea",
    "rooms",
    "bathrooms",
    "kitchen",
    "floors",
    "salePrice",
    "taxRate",
  ];

  numericFields.forEach((field) => {
    if (req.body[field] !== undefined && req.body[field] !== null) {
      const numValue = Number(req.body[field]);
      if (isNaN(numValue)) {
        delete req.body[field];
      } else {
        req.body[field] = numValue;
      }
    }
  });
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
    productData.planFile =
      req.files.planFile && req.files.planFile.length > 0
        ? req.files.planFile.map(getFilePath)
        : [];
    productData.galleryImages =
      req.files.galleryImages && req.files.galleryImages.length > 0
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

  const updates = { ...req.body };

  if (updates.productNo && product.productNo !== updates.productNo) {
    const productExists = await Product.findOne({
      productNo: updates.productNo,
    });
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

  if (req.files) {
    const getFilePath = (file) => file.location || file.path;
    if (req.files.mainImage) {
      updates.mainImage = getFilePath(req.files.mainImage[0]);
      updates.Images = updates.mainImage;
    }
    if (req.files.headerImage) {
      updates.headerImage = getFilePath(req.files.headerImage[0]);
    }
    if (req.files.galleryImages) {
      updates.galleryImages = req.files.galleryImages.map(getFilePath);
    }
    if (req.files.planFile) {
      const newPlanFiles = req.files.planFile.map(getFilePath);
      updates.planFile = [...(product.planFile || []), ...newPlanFiles];
    }
  }

  if (
    updates.seoTitle ||
    updates.seoDescription ||
    updates.seoKeywords ||
    updates.seoAltText
  ) {
    product.seo = {
      title:
        updates.seoTitle !== undefined ? updates.seoTitle : product.seo.title,
      description:
        updates.seoDescription !== undefined
          ? updates.seoDescription
          : product.seo.description,
      keywords:
        updates.seoKeywords !== undefined
          ? normalizeToArray(updates.seoKeywords)
          : product.seo.keywords,
      altText:
        updates.seoAltText !== undefined
          ? updates.seoAltText
          : product.seo.altText,
    };
  }

  if (updates.contactName || updates.contactEmail || updates.contactPhone) {
    product.contactDetails = {
      name:
        updates.contactName !== undefined
          ? updates.contactName
          : product.contactDetails.name,
      email:
        updates.contactEmail !== undefined
          ? updates.contactEmail
          : product.contactDetails.email,
      phone:
        updates.contactPhone !== undefined
          ? updates.contactPhone
          : product.contactDetails.phone,
    };
  }

  if (updates.country !== undefined) {
    product.country = normalizeToArray(updates.country);
  }
  if (updates.category !== undefined) {
    const normalizedCategories = normalizeToArray(updates.category);
    product.category = normalizedCategories;
    product.Categories = normalizedCategories.join(", ");
  }
  if (updates.crossSellProducts !== undefined) {
    product.crossSellProducts = normalizeToArray(updates.crossSellProducts);
  }
  if (updates.upSellProducts !== undefined) {
    product.upSellProducts = normalizeToArray(updates.upSellProducts);
  }

  Object.keys(updates).forEach((key) => {
    const handledKeys = [
      "seoTitle",
      "seoDescription",
      "seoKeywords",
      "seoAltText",
      "contactName",
      "contactEmail",
      "contactPhone",
      "country",
      "category",
      "crossSellProducts",
      "upSellProducts",
    ];
    if (handledKeys.includes(key)) return;

    product[key] = updates[key];
  });

  const updatedProduct = await product.save();
  await triggerVercelBuild();
  res.json(updatedProduct);
});

// <<< YAHAN BADLAAV KIYA GAYA HAI >>>
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (product) {
    // Permission check ko theek kiya gaya hai
    if (
      req.user.role !== "admin" &&
      (!product.user || product.user.toString() !== req.user._id.toString())
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
// <<< BADLAAV KHATAM >>>

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

const removeCsvImage = asyncHandler(async (req, res) => {
  const { imageUrl } = req.body;
  const productId = req.params.id;

  if (!imageUrl) {
    res.status(400);
    throw new Error("Image URL is required");
  }

  const product = await Product.findById(productId);

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  const imageString = product.Images;

  if (!imageString || typeof imageString !== "string") {
    return res.status(404).json({
      message:
        "Image list for this product is already empty or does not exist.",
    });
  }

  const imagesArray = imageString
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  const updatedImagesArray = imagesArray.filter(
    (img) => img.trim() !== imageUrl.trim()
  );

  if (imagesArray.length === updatedImagesArray.length) {
    return res
      .status(404)
      .json({ message: "Image URL not found in the product's image list." });
  }

  const newImageString = updatedImagesArray.join(", ");
  const updatedProduct = await Product.findByIdAndUpdate(
    productId,
    { Images: newImageString },
    { new: true }
  );

  await triggerVercelBuild();
  res.json(updatedProduct);
});

module.exports = {
  getProducts,
  getProductById,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  createProductReview,
  removeCsvImage,
};
