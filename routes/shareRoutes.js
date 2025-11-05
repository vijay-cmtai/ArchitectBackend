const express = require("express");
const router = express.Router();
const Product = require("../models/productModel");
// ⭐ FIX 1: ProfessionalPlan model ko bhi import karein
const ProfessionalPlan = require("../models/professionalPlanModel");

// Is function mein koi badlav nahi hai
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
    
    <!-- Primary Meta Tags -->
    <meta name="title" content="${name}">
    <meta name="description" content="${cleanDescription}">
    
    <!-- Open Graph / Facebook / WhatsApp -->
    <meta property="og:type" content="product">
    <meta property="og:url" content="${url}">
    <meta property="og:title" content="${name}">
    <meta property="og:description" content="${cleanDescription}">
    <meta property="og:image" content="${image}">
    <meta property="og:image:secure_url" content="${image}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:site_name" content="House Plan Files">
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${url}">
    <meta name="twitter:title" content="${name}">
    <meta name="twitter:description" content="${cleanDescription}">
    <meta name="twitter:image" content="${image}">
    
    <!-- Redirect user to the actual page -->
    <meta http-equiv="refresh" content="0;url=${url}">
    <script type="text/javascript">window.location.href = "${url}";</script>
</head>
<body>
    <p>Loading your house plan...</p>
</body>
</html>`;
};

const handleShareRequest = async (req, res, type) => {
  const { slug } = req.params;
  const id = slug.split("-").pop();

  const frontendUrl =
    process.env.FRONTEND_URL || "https://www.houseplanfiles.com";
  const productUrl = `${frontendUrl}/${type}/${slug}`;

  try {
    let item;
    // ⭐ FIX 1: 'type' ke aadhar par sahi model se data fetch karein
    if (type === "product") {
      item = await Product.findById(id);
    } else if (type === "professional-plan") {
      item = await ProfessionalPlan.findById(id);
    }

    if (!item) {
      console.warn(`⚠️ Item not found for type '${type}' with ID '${id}'. Redirecting.`);
      return res.redirect(productUrl);
    }

    const itemName = item.name || item.planName || item.Name || "House Plan";
    const itemDescription =
      item.description ||
      item.Description ||
      "Find and purchase architectural house plans for your dream home.";

    // ⭐ FIX 2: Image ka URL backend ke URL se banayein, frontend ke nahi
    let absoluteImageUrl;
    const dbImage =
      item.mainImage || (item.Images ? item.Images.split(",")[0].trim() : null);

    // Ye aapka backend ka public URL hai
    const backendUrl =
      process.env.VITE_BACKEND_URL || "https://architect-backend.vercel.app";

    if (!dbImage) {
      // Agar koi image nahi hai to default image use karein
      absoluteImageUrl = `${frontendUrl}/default-house-plan.jpg`; 
    } else if (dbImage.startsWith("http")) {
      // Agar pehle se hi poora URL hai (S3, etc.), to koi badlav nahi
      absoluteImageUrl = dbImage;
    } else {
      // Agar relative path hai, to backend ka URL jodein
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
    res.send(html);
  } catch (error) {
    console.error(`❌ Share route error for ${slug}:`, error);
    res.redirect(productUrl);
  }
};

router.get("/product/:slug", (req, res) => handleShareRequest(req, res, "product"));
router.get("/professional-plan/:slug", (req, res) => handleShareRequest(req, res, "professional-plan"));

// ⭐ FIX 3: 'handleShareRequest' function ko export karein taaki server.js use kar sake
module.exports = { router, handleShareRequest };
