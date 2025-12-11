const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");

// ROUTES
const userRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/productRoutes");
const professionalPlanRoutes = require("./routes/professionalPlanRoutes");
const customizationRequestRoutes = require("./routes/customizationRequestRoutes");
const standardRequestRoutes = require("./routes/standardRequestRoutes");
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
const shareRoutes = require("./routes/shareRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

const { notFound, errorHandler } = require("./middleware/errorMiddleware");

dotenv.config();
connectDB();

const app = express();

// ======================
// 🔥 LOGGING MIDDLEWARE
// ======================
app.use((req, res, next) => {
  const hostUrl = req.protocol + "://" + req.get("host");

  console.log("===== NEW REQUEST RECEIVED =====");
  console.log("Host URL:", hostUrl);
  console.log("Full URL:", hostUrl + req.originalUrl);
  console.log("Headers:", req.headers);
  console.log("Request Payload:", req.body);
  console.log("==================================");

  next();
});

// =====================
// ✅ CORS FIX (Vercel)
// =====================
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://www.houseplanfiles.com");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-requested-with"
  );
  res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "/uploads")));

// ==============================
// ROUTES
// ==============================
app.get("/", (req, res) => {
  res.send("API is running...");
});

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
app.use("/share", shareRoutes);
app.use("/api/notifications", notificationRoutes);

// ERROR HANDLERS
app.use(notFound);
app.use(errorHandler);

// PORT
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app; // for vercel
