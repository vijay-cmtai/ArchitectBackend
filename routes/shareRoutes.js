const express = require("express");
const router = express.Router();
const Product = require("../models/productModel");

// Helper function to generate HTML
const generateShareHTML = (data) => {
  const { name, description, image, url, price } = data;

  // Clean description from HTML tags
  const cleanDescription = description.replace(/<[^>]*>/g, "").substring(0, 160);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${name} | House Plan Files</title>
    
    <!-- Primary Meta Tags -->
    <meta name="title" content="${name}">
    <meta name="description" content="${cleanDescription}">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="product">
    <meta property="og:url" content="${url}">
    <meta property="og:title" content="${name}">
    <meta property="og:description" content="${cleanDescription}">
    <meta property="og:image" content="${image}">
    <meta property="og:image:secure_url" content="${image}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name" content="House Plan Files">
    ${price ? `<meta property="product:price:amount" content="${price}">` : ""}
    ${price ? `<meta property="product:price:currency" content="INR">` : ""}
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${url}">
    <meta name="twitter:title" content="${name}">
    <meta name="twitter:description" content="${cleanDescription}">
    <meta name="twitter:image" content="${image}">
    
    <!-- Redirect to actual page -->
    <meta http-equiv="refresh" content="0;url=${url}">
    <script>setTimeout(() => window.location.href = "${url}", 50);</script>
    
    <style>
      body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background-color: #f0f2f5; }
      .loader { text-align: center; color: #333; }
    </style>
</head>
<body>
    <div class="loader">
      <h2>${name}</h2>
      <p>Redirecting to the plan page...</p>
      <p style="font-size: 14px;"><a href="${url}">Click here</a> if you are not redirected.</p>
    </div>
</body>
</html>
  `;
};

// Generic handler for both types of products
const handleShareRequest = async (req, res, type) => {
  const { slug } = req.params;
  const id = slug.split("-").pop();

  // Redirect ke liye FRONTEND URL ka istemal hoga
  const frontendUrl = `${process.env.FRONTEND_URL || "https://www.houseplanfiles.com"}/${type}/${slug}`;
  
  // Image banane ke liye BACKEND URL ka istemal hoga
  const backendUrl = process.env.BACKEND_URL || "https://architect-backend.vercel.app";

  try {
    const item = await Product.findById(id);

    // Agar item nahi milta, to seedha frontend par redirect kar do
    if (!item) {
      return res.redirect(frontendUrl);
    }

    const itemName = item.name || item.Name || "House Plan";
    const itemDescription = item.description || item.Description || "Find and purchase architectural house plans for your dream home.";
    
    // Database se relative image path nikalo
    const relativeImagePath = item.mainImage || (item.Images ? item.Images.split(",")[0].trim() : "/default-logo.png"); // Ek default logo rakhein
    
    // BACKEND_URL ka istemal karke poora image URL banao
    const absoluteImageUrl = relativeImagePath.startsWith("http")
      ? relativeImagePath
      : `${backendUrl}${relativeImagePath.startsWith("/") ? "" : "/"}${relativeImagePath}`;

    const itemPrice = item.salePrice || item.price || 0;

    const html = generateShareHTML({
      name: itemName,
      description: itemDescription,
      image: absoluteImageUrl, // Yahan sahi URL pass hoga
      url: frontendUrl,        // Redirect ke liye frontend ka URL pass hoga
      price: itemPrice,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.send(html);

  } catch (error) {
    console.error(`Share route error for ${slug}:`, error);
    // Error aane par bhi frontend par redirect kar do
    res.redirect(frontendUrl);
  }
};

// Route for ADMIN products
router.get("/product/:slug", (req, res) => {
  handleShareRequest(req, res, 'product');
});

// Route for PROFESSIONAL plans
router.get("/professional-plan/:slug", (req, res) => {
  handleShareRequest(req, res, 'professional-plan');
});

module.exports = router;
