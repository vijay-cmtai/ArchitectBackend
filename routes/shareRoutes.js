const express = require("express");
const router = express.Router();
const Product = require("../models/productModel");

const generateShareHTML = (data) => {
  const { name, description, image, url, price } = data;
  const cleanDescription = description.replace(/<[^>]*>/g, "").substring(0, 160);

  return `<!DOCTYPE html>
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
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:site_name" content="House Plan Files">
    ${price ? `<meta property="product:price:amount" content="${price}">` : ""}
    ${price ? `<meta property="product:price:currency" content="INR">` : ""}
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${url}">
    <meta name="twitter:title" content="${name}">
    <meta name="twitter:description" content="${cleanDescription}">
    <meta name="twitter:image" content="${image}">
    <meta name="twitter:image:alt" content="${name}">
    
    <!-- WhatsApp -->
    <meta property="og:image:alt" content="${name}">
    
    <!-- Redirect -->
    <meta http-equiv="refresh" content="0;url=${url}">
    <script>setTimeout(() => window.location.href = "${url}", 100);</script>
    
    <style>
      body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
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
      <p>Loading plan...</p>
      <p style="font-size: 14px; opacity: 0.8; margin-top: 20px;">If not redirected, <a href="${url}">click here</a></p>
    </div>
</body>
</html>`;
};

const handleShareRequest = async (req, res, type) => {
  const { slug } = req.params;
  const id = slug.split("-").pop();

  // Frontend URL for redirect
  const frontendUrl = process.env.FRONTEND_URL || "https://www.houseplanfiles.com";
  const productUrl = `${frontendUrl}/${type}/${slug}`;

  try {
    const item = await Product.findById(id);

    if (!item) {
      return res.redirect(productUrl);
    }

    const itemName = item.name || item.Name || "House Plan";
    const itemDescription = item.description || item.Description || "Find and purchase architectural house plans for your dream home.";
    const itemPrice = item.salePrice || item.price || 0;

    // ===== IMAGE URL GENERATION - YEH HAI IMPORTANT PART =====
    let absoluteImageUrl;
    
    // Step 1: Get image from database
    const dbImage = item.mainImage || (item.Images ? item.Images.split(",")[0].trim() : null);

    if (!dbImage) {
      // No image in database - use default
      absoluteImageUrl = `${frontendUrl}/default-house-plan.jpg`;
    } else if (dbImage.startsWith("http://") || dbImage.startsWith("https://")) {
      // Already absolute URL (e.g., S3, Cloudinary)
      absoluteImageUrl = dbImage;
    } else {
      // Relative URL - convert to absolute
      // Remove leading slash if exists, then add frontend URL
      const cleanPath = dbImage.startsWith("/") ? dbImage.substring(1) : dbImage;
      absoluteImageUrl = `${frontendUrl}/${cleanPath}`;
    }

    console.log(`📸 Image URL for ${slug}: ${absoluteImageUrl}`);

    const html = generateShareHTML({
      name: itemName,
      description: itemDescription,
      image: absoluteImageUrl,
      url: productUrl,
      price: itemPrice,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.send(html);

  } catch (error) {
    console.error(`❌ Share route error for ${slug}:`, error);
    res.redirect(productUrl);
  }
};

router.get("/product/:slug", (req, res) => handleShareRequest(req, res, "product"));
router.get("/professional-plan/:slug", (req, res) => handleShareRequest(req, res, "professional-plan"));

module.exports = router;
