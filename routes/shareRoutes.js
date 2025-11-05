// backend/routes/shareRoutes.js
const express = require("express");
const router = express.Router();
const Product = require("../models/productModel");

// Helper function to generate HTML
const generateShareHTML = (data) => {
  const { name, description, image, url, price } = data;

  const cleanDescription = description
    .replace(/<[^>]*>/g, "")
    .substring(0, 160);
  
  // Is function me ab kuch nahi badalna hai, kyunki hum absolute URL pehle hi bana kar bhejenge.
  // Lekin fir bhi ek fallback rakhna aacha hai.
  const absoluteImageUrl = image; 

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
    <meta property="og:image" content="${absoluteImageUrl}">
    <meta property="og:image:secure_url" content="${absoluteImageUrl}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:site_name" content="House Plan Files">
    ${price ? `<meta property="product:price:amount" content="${price}">` : ""}
    ${price ? `<meta property="product:price:currency" content="INR">` : ""}
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${url}">
    <meta name="twitter:title" content="${name}">
    <meta name="twitter:description" content="${cleanDescription}">
    <meta name="twitter:image" content="${absoluteImageUrl}">
    <meta name="twitter:image:alt" content="${name}">
    
    <!-- Redirect to actual page -->
    <meta http-equiv="refresh" content="0;url=${url}">
    <script>
      setTimeout(function() { window.location.href = "${url}"; }, 100);
    </script>
    
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
      .loader { text-align: center; }
      .spinner { border: 4px solid rgba(255,255,255,0.3); border-radius: 50%; border-top: 4px solid white; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 20px; }
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      a { color: white; text-decoration: underline; }
    </style>
</head>
<body>
    <div class="loader">
      <div class="spinner"></div>
      <h2>${name}</h2>
      <p>Loading your plan...</p>
      <p style="font-size: 14px; opacity: 0.8; margin-top: 20px;">If you're not redirected, <a href="${url}">click here</a></p>
    </div>
</body>
</html>
  `;
};

// Generic handler for both types of products to avoid repeating code
const handleShareRequest = async (req, res, type) => {
  const slug = req.params.slug;
  const id = slug.split("-").pop();

  const frontendUrl = `${process.env.FRONTEND_URL || "https://houseplanfiles.com"}/${type}/${slug}`;
  const backendUrl = process.env.BACKEND_URL || "http://localhost:5000"; // IMPORTANT: Use BACKEND_URL

  try {
    const item = await Product.findById(id);

    if (!item) {
      return res.status(404).send(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${frontendUrl}"></head><body>Item not found. Redirecting...</body></html>`);
    }

    const itemName = item.name || item.planName || item.Name || "House Plan";
    const itemDescription = item.description || item.Description || "Premium house plan design";
    
    // Get the relative image path from the database
    const relativeImagePath = item.mainImage || (item.Images ? item.Images.split(",")[0].trim() : "/default-image.jpg");
    
    // Create the full, absolute image URL using the BACKEND_URL
    const absoluteImageUrl = relativeImagePath.startsWith("http")
      ? relativeImagePath
      : `${backendUrl}${relativeImagePath.startsWith("/") ? "" : "/"}${relativeImagePath}`;

    const itemPrice = item.salePrice || item.price || 0;

    const html = generateShareHTML({
      name: itemName,
      description: itemDescription,
      image: absoluteImageUrl, // Pass the correctly formed absolute URL
      url: frontendUrl,        // Pass the frontend URL for redirection and meta tags
      price: itemPrice,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.send(html);

  } catch (error) {
    console.error(`Share route error for ${type}/${slug}:`, error);
    const homeUrl = process.env.FRONTEND_URL || "https://houseplanfiles.com";
    res.status(500).send(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${homeUrl}"></head><body>Server error. Redirecting home...</body></html>`);
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
