const express = require("express");
const router = express.Router();
const Product = require("../models/productModel");

const generateShareHTML = (data) => {
  const { name, description, image, url, price } = data;
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
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="product">
    <meta property="og:url" content="${url}">
    <meta property="og:title" content="${name}">
    <meta property="og:description" content="${cleanDescription}">
    <meta property="og:image" content="${image}">
    <meta property="og:image:secure_url" content="${image}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${name}">
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
    
    <!-- JavaScript Redirect (Only for Browsers, NOT Bots) -->
    <script>
      // Check if it's a bot/crawler
      const isBot = /bot|crawler|spider|crawling|facebook|twitter|linkedin|whatsapp/i.test(navigator.userAgent);
      
      // Only redirect if NOT a bot
      if (!isBot) {
        setTimeout(() => {
          window.location.href = "${url}";
        }, 500);
      }
    </script>
    
    <style>
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        display: flex; 
        justify-content: center; 
        align-items: center; 
        min-height: 100vh; 
        margin: 0; 
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
        color: white;
        padding: 20px;
      }
      .content { 
        text-align: center; 
        max-width: 600px;
        background: rgba(255,255,255,0.1);
        padding: 40px;
        border-radius: 20px;
        backdrop-filter: blur(10px);
      }
      .product-image {
        width: 100%;
        max-width: 400px;
        height: 250px;
        object-fit: cover;
        border-radius: 12px;
        margin: 20px auto;
        display: block;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      }
      h1 { 
        margin: 0 0 16px 0; 
        font-size: 28px;
        font-weight: 700;
      }
      p { 
        font-size: 16px; 
        opacity: 0.9; 
        line-height: 1.6;
        margin: 12px 0;
      }
      .price {
        font-size: 32px;
        font-weight: 800;
        color: #ffd700;
        margin: 20px 0;
      }
      .spinner { 
        border: 4px solid rgba(255,255,255,0.3); 
        border-radius: 50%; 
        border-top: 4px solid white; 
        width: 50px; 
        height: 50px; 
        animation: spin 1s linear infinite; 
        margin: 20px auto; 
      }
      @keyframes spin { 
        0% { transform: rotate(0deg); } 
        100% { transform: rotate(360deg); } 
      }
      a { 
        color: #ffd700; 
        text-decoration: none;
        font-weight: 600;
        padding: 12px 32px;
        background: rgba(255,255,255,0.2);
        border-radius: 8px;
        display: inline-block;
        margin-top: 20px;
        transition: all 0.3s;
      }
      a:hover {
        background: rgba(255,255,255,0.3);
        transform: translateY(-2px);
      }
    </style>
</head>
<body>
    <div class="content">
      <h1>${name}</h1>
      <img src="${image}" alt="${name}" class="product-image" onerror="this.style.display='none'">
      <p>${cleanDescription}</p>
      ${price ? `<div class="price">₹${Number(price).toLocaleString('en-IN')}</div>` : ''}
      <div class="spinner"></div>
      <p style="font-size: 14px; margin-top: 30px;">Redirecting to House Plan Files...</p>
      <a href="${url}">Click here if not redirected automatically</a>
    </div>
</body>
</html>`;
};

const handleShareRequest = async (req, res, type) => {
  const { slug } = req.params;
  const id = slug.split("-").pop();

  const frontendUrl = process.env.FRONTEND_URL || "https://www.houseplanfiles.com";
  const productUrl = `${frontendUrl}/${type}/${slug}`;
  const backendUrl = process.env.BACKEND_URL || "https://architect-backend.vercel.app";

  try {
    const item = await Product.findById(id);

    if (!item) {
      console.log(`⚠️ Product not found: ${id}`);
      return res.redirect(productUrl);
    }

    const itemName = item.name || item.Name || "House Plan";
    const itemDescription = item.description || item.Description || "Find and purchase architectural house plans for your dream home.";
    const itemPrice = item.salePrice || item.price || 0;

    // Image URL generation
    let absoluteImageUrl;
    const dbImage = item.mainImage || (item.Images ? item.Images.split(",")[0].trim() : null);

    if (!dbImage) {
      absoluteImageUrl = `${backendUrl}/uploads/default-house.jpg`;
    } else if (dbImage.startsWith("http://") || dbImage.startsWith("https://")) {
      absoluteImageUrl = dbImage;
    } else {
      const cleanPath = dbImage.startsWith("/") ? dbImage : `/${dbImage}`;
      absoluteImageUrl = `${backendUrl}${cleanPath}`;
    }

    // Force HTTPS
    absoluteImageUrl = absoluteImageUrl.replace(/^http:/, "https:");

    console.log(`✅ Share page generated for: ${itemName}`);
    console.log(`📸 Image URL: ${absoluteImageUrl}`);
    console.log(`📝 Description length: ${itemDescription.replace(/<[^>]*>/g, "").substring(0, 160).length} chars`);

    const html = generateShareHTML({
      name: itemName,
      description: itemDescription,
      image: absoluteImageUrl,
      url: productUrl,
      price: itemPrice,
    });

    // CRITICAL: Headers for social media crawlers
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400"); // Cache for 24 hours
    res.setHeader("X-Robots-Tag", "noindex, follow");
    
    // IMPORTANT: Don't set any redirect headers
    res.status(200).send(html);
    
  } catch (error) {
    console.error(`❌ Share route error for ${slug}:`, error.message);
    res.redirect(productUrl);
  }
};

router.get("/product/:slug", (req, res) => handleShareRequest(req, res, "product"));
router.get("/professional-plan/:slug", (req, res) => handleShareRequest(req, res, "professional-plan"));

module.exports = router;
