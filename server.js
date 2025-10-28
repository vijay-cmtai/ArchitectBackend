// server.js
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");

// --- Import Routes ---
const userRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/productRoutes");
const professionalPlanRoutes = require("./routes/professionalPlanRoutes");
const customizationRequestRoutes = require("./routes/customizationRequestRoutes");
const standardRequestRoutes = require("./routes/standardRequestRoutes");
const premiumRequestRoutes = require("./routes/premiumRequestRoutes");
const corporateInquiryRoutes = require("./routes/corporateInquiryRoutes");
const inquiryRoutes = require("./routes/inquiryRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const adminRoutes = require("./routes/adminRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const blogRoutes = require("./routes/blogRoutes");
const galleryRoutes = require("./routes/galleryRoutes");
const videoRoutes = require("./routes/videoRoutes");
const packageRoutes = require("./routes/packageRoutes");
const professionalOrderRoutes = require("./routes/professionalOrderRoutes");
const sellerProductRoutes = require("./routes/sellerProductRoutes");
const sellerinquiryRoutes = require("./routes/sellerinquiryRoutes");
const mediaRoutes = require("./routes/mediaRoutes");

// --- Middleware ---
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

// --- Environment & DB Connection ---
dotenv.config();
connectDB();

const app = express();

// ✅ --- FIXED & PRODUCTION-SAFE CORS CONFIG ---
const allowedOrigins = [
  "https://www.houseplanfiles.com",
  "https://houseplanfiles.com",
  "http://localhost:3000",
  "http://localhost:3036", // optional local port
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ✅ Handle Preflight (OPTIONS) requests for all routes
app.options("*", cors());

// ✅ Body Parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Static folder for uploads
app.use("/uploads", express.static(path.join(__dirname, "/uploads")));

// ✅ Test Route
app.get("/", (req, res) => {
  res.send("✅ API is running successfully...");
});

// ✅ All Routes
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

// ✅ Error Middleware
app.use(notFound);
app.use(errorHandler);

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
