const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");

// Aapke saare route imports
const userRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/productRoutes");
const professionalPlanRoutes = require("./routes/professionalPlanRoutes");
const customizationRequestRoutes = require("./routes/customizationRequestRoutes");
const standardRequestRoutes = require("./routes/standardRequestRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const premiumRequestRoutes = require("./routes/premiumRequestRoutes");
const corporateInquiryRoutes = require("./routes/corporateInquiryRoutes");
const inquiryRoutes = require("./routes/inquiryRoutes.js");
const cartRoutes = require("./routes/cartRoutes.js");
const orderRoutes = require("./routes/orderRoutes.js");
const adminRoutes = require("./routes/adminRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes.js");
const blogRoutes = require("./routes/blogRoutes.js");
const galleryRoutes = require("./routes/galleryRoutes.js");
const videoRoutes = require("./routes/videoRoutes.js");
const packageRoutes = require("./routes/packageRoutes.js");
const professionalOrderRoutes = require("./routes/professionalOrderRoutes.js");
const sellerProductRoutes = require("./routes/sellerProductRoutes");
const sellerinquiryRoutes = require("./routes/sellerinquiryRoutes.js");
const mediaRoutes = require("./routes/mediaRoutes.js");

// shareRoutes se router aur handler dono import karein
const { router: shareRouter, handleShareRequest } = require("./routes/shareRoutes");

dotenv.config();
connectDB();

const app = express();

// Aapka CORS configuration
app.use(
  cors({
    origin: ["https://www.houseplanfiles.com", "http://localhost:3000", "http://localhost:5173"],
    credentials: true,
  })
);

app.use(express.json());


// --- API ROUTES ---
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/professional-plans", professionalPlanRoutes);
app.use("/api/customize", customizationRequestRoutes);
app.use("/api/standard-requests", standardRequestRoutes);
app.use("/api/premium-requests", premiumRequestRoutes);
app.use("/api/corporate-inquiries", corporateInquiryRoutes);
app.use("/api/inquiries", inquiryRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/videos", videoRoutes);
app.use("/api/packages", packageRoutes);
app.use("/api/professional-orders", professionalOrderRoutes);
app.use("/api/seller/products", sellerProductRoutes);
app.use("/api/sellerinquiries", sellerinquiryRoutes);
app.use("/api/media", mediaRoutes);

// Share button ke special URL ke liye '.router' use karein
app.use("/share", shareRouter);


// Social Share Middleware jo direct copy-paste kiye gaye URLs ke liye bots ko pakadta hai
const socialShareMiddleware = async (req, res, next) => {
  const userAgent = req.headers["user-agent"] || "";
  const crawlers = [ "facebookexternalhit", "Twitterbot", "WhatsApp", "LinkedInBot", "Pinterest", "TelegramBot" ];
  const isCrawler = crawlers.some((crawler) => userAgent.toLowerCase().includes(crawler.toLowerCase()));

  const productMatch = req.path.match(/^\/product\/(.*)/);
  const planMatch = req.path.match(/^\/professional-plan\/(.*)/);

  if (isCrawler) {
    if (productMatch) {
      req.params.slug = productMatch[1];
      return handleShareRequest(req, res, "product");
    }
    if (planMatch) {
      req.params.slug = planMatch[1];
      return handleShareRequest(req, res, "professional-plan");
    }
  }
  next();
};


// --- FRONTEND SERVING LOGIC (API routes ke baad) ---
// ⭐ FIX: Yahan se 'const __dirname = path.resolve();' line hata di gayi hai
app.use("/uploads", express.static(path.join(__dirname, "/uploads")));

// Production environment mein React app ko serve karein
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "/frontend/dist")));

  // Middleware ko React app serve karne se theek pehle use karein
  app.use(socialShareMiddleware);

  app.get("*", (req, res) =>
    res.sendFile(path.resolve(__dirname, "frontend", "dist", "index.html"))
  );
} else {
  app.get("/", (req, res) => {
    res.send("API is running in development mode...");
  });
}

// --- ERROR HANDLING MIDDLEWARE (sabse aakhir mein) ---
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, console.log(`Server running on port ${PORT}`));
