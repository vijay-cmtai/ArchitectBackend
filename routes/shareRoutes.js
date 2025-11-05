const express = require("express");
const router = express.Router();
const Product = require("../models/productModel");
// ⭐ FIX 1: ProfessionalPlan model ko bhi import karein
const ProfessionalPlan = require("../models/professionalPlanModel");

const generateShareHTML = (data) => {
  const { name, description, image, url } = data;
  const cleanDescription = description
    .replace(/<[^>]*>/g, "")
    .substring(0, 160);

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${name} | House Plan Files</title>
    
    <!-- Meta Tags for Social Media Crawlers -->
    <meta property="og:title" content="${name}">
    <meta property="og:description" content="${cleanDescription}">
    <meta property="og:image" content="${image}">
    <meta property="og:image:secure_url" content="${image}">
    <meta property="og:url" content="${url}">
    <meta property="og:type" content="product">
    <meta name="twitter:card" content="summary_large_image">
    
    <!-- ⭐ FIX 2: Sabse zaroori - User ko redirect karne ke liye meta tag -->
    <meta http-equiv="refresh" content="0;url=${url}">
    <script type="text/javascript">window.location.href = "${url}";</script>
    
    <style>body { font-family: sans-serif; text-align: center; padding-top: 50px; background-color: #f0f2f5; } h1 { color: #333; }</style>
</head>
<body>
    <h1>Loading ${name}...</h1>
    <p>You are being redirected to the house plan page.</p>
    <p>If not redirected, <a href="${url}">click here</a>.</p>
</body>
</html>`;
};

const handleShareRequest = async (req, res, type) => {
  const { slug } = req.params;
  const id = slug.split("-").pop();

  const frontendUrl =
    process.env.FRONTEND_URL || "https://www.houseplanfiles.com";
  const productUrl = `${frontendUrl}/${type}/${slug}`;
  const backendUrl =
    process.env.BACKEND_URL || "https://architect-backend.vercel.app";

  try {
    let item;
    // ⭐ FIX 1: 'type' ke aadhar par sahi model se data fetch karein
    if (type === 'product') {
        item = await Product.findById(id);
    } else if (type === 'professional-plan') {
        item = await ProfessionalPlan.findById(id);
    }

    if (!item) {
      console.log(`⚠️ Item not found: ${id} of type ${type}`);
      return res.redirect(productUrl);
    }

    const itemName = item.name || item.planName || item.Name || "House Plan";
    const itemDescription =
      item.description ||
      item.Description ||
      "Find and purchase architectural house plans for your dream home.";

    let absoluteImageUrl;
    const dbImage =
      item.mainImage || (item.Images ? item.Images.split(",")[0].trim() : null);

    if (!dbImage) {
      absoluteImageUrl = `${frontendUrl}/default-house-plan.jpg`; // Yahan default image ka link daalein
    } else if (dbImage.startsWith("http")) {
      absoluteImageUrl = dbImage;
    } else {
      const cleanPath = dbImage.startsWith("/") ? dbImage.substring(1) : dbImage;
      absoluteImageUrl = `${backendUrl}/${cleanPath}`;
    }

    const html = generateShareHTML({
      name: itemName,
      description: itemDescription,
      image: absoluteImageUrl,
      url: productUrl,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.status(200).send(html);
  } catch (error) {
    console.error(`❌ Share route error for ${slug}:`, error.message);
    res.redirect(productUrl);
  }
};

router.get("/product/:slug", (req, res) => handleShareRequest(req, res, "product"));
router.get("/professional-plan/:slug", (req, res) => handleShareRequest(req, res, "professional-plan"));

// 'handleShareRequest' function ko export karein taaki server.js use kar sake
module.exports = { router, handleShareRequest };
