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

  // Handle country field - check if it's string or array
  let countryArray;
  if (typeof country === "string") {
    countryArray = country.split(",").map((c) => c.trim());
  } else if (Array.isArray(country)) {
    countryArray = country;
  } else {
    countryArray = [country];
  }

  // Handle city field - check if it's string or array
  let cityArray;
  if (typeof city === "string") {
    cityArray = city.split(",").map((c) => c.trim());
  } else if (Array.isArray(city)) {
    cityArray = city;
  } else {
    cityArray = [city];
  }

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

  // Handle crossSellProducts - check if it's string or array
  if (crossSellProducts) {
    if (typeof crossSellProducts === "string") {
      productData.crossSellProducts = crossSellProducts
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
    } else if (Array.isArray(crossSellProducts)) {
      productData.crossSellProducts = crossSellProducts.filter(Boolean);
    }
  }

  // Handle upSellProducts - check if it's string or array
  if (upSellProducts) {
    if (typeof upSellProducts === "string") {
      productData.upSellProducts = upSellProducts
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
    } else if (Array.isArray(upSellProducts)) {
      productData.upSellProducts = upSellProducts.filter(Boolean);
    }
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

  // Don't use Object.assign directly - it causes type casting issues with FormData
  // Update fields individually with proper type handling
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
      // Handle numeric fields
      if (
        [
          "price",
          "salePrice",
          "plotArea",
          "rooms",
          "bathrooms",
          "kitchen",
          "floors",
        ].includes(field)
      ) {
        const value = Array.isArray(req.body[field])
          ? req.body[field][0]
          : req.body[field];
        product[field] = value ? Number(value) : undefined;
      } else {
        // Handle string fields - take first element if array
        product[field] = Array.isArray(req.body[field])
          ? req.body[field][0]
          : req.body[field];
      }
    }
  });

  // Handle special fields that might come as arrays from FormData
  if (req.body.direction !== undefined) {
    product.direction = Array.isArray(req.body.direction)
      ? req.body.direction[0]
      : req.body.direction;
  }

  if (req.body.planType !== undefined) {
    product.planType = Array.isArray(req.body.planType)
      ? req.body.planType[0]
      : req.body.planType;
  }

  if (req.body.propertyType !== undefined) {
    product.propertyType = Array.isArray(req.body.propertyType)
      ? req.body.propertyType[0]
      : req.body.propertyType;
  }

  if (req.body.isSale !== undefined) {
    const saleValue = Array.isArray(req.body.isSale)
      ? req.body.isSale[0]
      : req.body.isSale;
    product.isSale = saleValue === "true" || saleValue === true;
  }

  // Handle country field - check if it's string or array
  if (country !== undefined) {
    if (typeof country === "string") {
      product.country = country.split(",").map((c) => c.trim());
    } else if (Array.isArray(country)) {
      product.country = country;
    } else {
      product.country = [country];
    }
  }

  // Handle city field - check if it's string or array
  if (city !== undefined) {
    if (typeof city === "string") {
      product.city = city.split(",").map((c) => c.trim());
    } else if (Array.isArray(city)) {
      product.city = city;
    } else {
      product.city = [city];
    }
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

  // Handle crossSellProducts - check if it's string or array
  if (crossSellProducts !== undefined) {
    if (typeof crossSellProducts === "string") {
      product.crossSellProducts = crossSellProducts
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
    } else if (Array.isArray(crossSellProducts)) {
      product.crossSellProducts = crossSellProducts.filter(Boolean);
    }
  }

  // Handle upSellProducts - check if it's string or array
  if (upSellProducts !== undefined) {
    if (typeof upSellProducts === "string") {
      product.upSellProducts = upSellProducts
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
    } else if (Array.isArray(upSellProducts)) {
      product.upSellProducts = upSellProducts.filter(Boolean);
    }
  }

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
