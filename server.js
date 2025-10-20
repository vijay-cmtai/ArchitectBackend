const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");

// Import routes
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

// Middleware
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

// Environment & Database
dotenv.config();
connectDB();

const app = express();

// ✅ FIXED CORS CONFIGURATION
app.use(
  cors({
    origin: [
      "https://www.houseplanfiles.com", // your production frontend
      "https://houseplanfiles.com",     // non-www version
      "http://localhost:3000",          // local development
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// Handle preflight requests
app.options("*", cors());

// Body parser
app.use(express.json());

// Static folder for uploads
app.use("/uploads", express.static(path.join(__dirname, "/uploads")));

// Test route
app.get("/", (req, res) => {
  res.send("API is running...");
});

// All routes
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

// Error handling
app.use(notFound);
app.use(errorHandler);

// Server start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
