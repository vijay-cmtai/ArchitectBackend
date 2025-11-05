// backend/routes/shareRoutes.js
const express = require("express");
const router = express.Router();
const Product = require("../models/productModel");

// Helper function to generate HTML
const generateShareHTML = (data) => {
  const { name, description, image, url, price } = data;

  // Clean description from HTML tags
  const cleanDescription = description
    .replace(/<[^>]*>/g, "")
    .substring(0, 160);

  // Ensure absolute image URL
  const absoluteImageUrl = image.startsWith("http")
    ? image
    : `${process.env.FRONTEND_URL || "https://houseplanfiles.com"}${image}`;

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
    
    <!-- WhatsApp -->
    <meta property="og:image:alt" content="${name}">
    
    <!-- Redirect to actual page -->
    <meta http-equiv="refresh" content="0;url=${url}">
    <script>
      setTimeout(function() {
        window.location.href = "${url}";
      }, 100);
    </script>
    
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        margin: 0;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }
      .loader {
        text-align: center;
      }
      .spinner {
        border: 4px solid rgba(255,255,255,0.3);
        border-radius: 50%;
        border-top: 4px solid white;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
        margin: 0 auto 20px;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      a {
        color: white;
        text-decoration: underline;
      }
    </style>
</head>
<body>
    <div class="loader">
      <div class="spinner"></div>
      <h2>${name}</h2>
      <p>Loading your plan...</p>
      <p style="font-size: 14px; opacity: 0.8; margin-top: 20px;">
        If you're not redirected, <a href="${url}">click here</a>
      </p>
    </div>
</body>
</html>
  `;
};

// Route for ADMIN products (from productSlice)
router.get("/product/:slug", async (req, res) => {
  const slug = req.params.slug;
  const productId = slug.split("-").pop();

  try {
    const product = await Product.findById(productId);

    if (!product) {
      const frontendUrl = `${process.env.FRONTEND_URL || "https://houseplanfiles.com"}/product/${slug}`;
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta http-equiv="refresh" content="0;url=${frontendUrl}">
        </head>
        <body>Product not found. <a href="${frontendUrl}">Click here</a> if not redirected.</body>
        </html>
      `);
    }

    const productName = product.name || product.Name || "House Plan";
    const productDescription =
      product.description || product.Description || "Premium house plan design";
    const productImage =
      product.mainImage ||
      (product.Images ? product.Images.split(",")[0].trim() : "") ||
      `${process.env.FRONTEND_URL}/default-image.jpg`;
    const productPrice = product.salePrice || product.price || 0;
    const productUrl = `${process.env.FRONTEND_URL || "https://houseplanfiles.com"}/product/${slug}`;

    const html = generateShareHTML({
      name: productName,
      description: productDescription,
      image: productImage,
      url: productUrl,
      price: productPrice,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.send(html);
  } catch (error) {
    console.error("Share route error:", error);
    const frontendUrl = `${process.env.FRONTEND_URL || "https://houseplanfiles.com"}`;
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta http-equiv="refresh" content="0;url=${frontendUrl}">
      </head>
      <body>Server error. <a href="${frontendUrl}">Click here</a> to go home.</body>
      </html>
    `);
  }
});

// Route for PROFESSIONAL plans (from professionalPlanSlice)
router.get("/professional-plan/:slug", async (req, res) => {
  const slug = req.params.slug;
  const planId = slug.split("-").pop();

  try {
    // Professional plans bhi Product model mein store hote hain
    // Ya agar alag model hai to use import karein
    const plan = await Product.findById(planId);

    if (!plan) {
      const frontendUrl = `${process.env.FRONTEND_URL || "https://houseplanfiles.com"}/professional-plan/${slug}`;
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta http-equiv="refresh" content="0;url=${frontendUrl}">
        </head>
        <body>Plan not found. <a href="${frontendUrl}">Click here</a> if not redirected.</body>
        </html>
      `);
    }

    const planName =
      plan.planName || plan.name || plan.Name || "Professional House Plan";
    const planDescription =
      plan.description || plan.Description || "Professional house plan design";
    const planImage =
      plan.mainImage ||
      (plan.Images ? plan.Images.split(",")[0].trim() : "") ||
      `${process.env.FRONTEND_URL}/default-image.jpg`;
    const planPrice = plan.salePrice || plan.price || 0;
    const planUrl = `${process.env.FRONTEND_URL || "https://houseplanfiles.com"}/professional-plan/${slug}`;

    const html = generateShareHTML({
      name: planName,
      description: planDescription,
      image: planImage,
      url: planUrl,
      price: planPrice,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.send(html);
  } catch (error) {
    console.error("Professional plan share route error:", error);
    const frontendUrl = `${process.env.FRONTEND_URL || "https://houseplanfiles.com"}`;
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta http-equiv="refresh" content="0;url=${frontendUrl}">
      </head>
      <body>Server error. <a href="${frontendUrl}">Click here</a> to go home.</body>
      </html>
    `);
  }
});

module.exports = router;
