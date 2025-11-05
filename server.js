const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");

// --- Route Imports ---
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
const sellerDashboardRoutes = require("./routes/sellerDashboardRoutes.js");
const shareRoutes = require("./routes/shareRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

dotenv.config();
connectDB();

const app = express();

// --- CORS Setup ---
const allowedOrigins = [
  "https://www.houseplanfiles.com",
  "https://houseplanfiles.com",
  "http://localhost:3000",
  "http://localhost:5173",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// --- Middleware ---
app.use(express.json());

// --- API Routes ---
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
app.use("/api/seller-dashboard", sellerDashboardRoutes);
app.use("/share", shareRoutes.router);

// --- Social Share Middleware ---
const socialShareMiddleware = async (req, res, next) => {
  const userAgent = req.headers["user-agent"] || "";
  const crawlers = [
    "facebookexternalhit",
    "Twitterbot",
    "WhatsApp",
    "LinkedInBot",
    "Pinterest",
    "TelegramBot",
  ];
  const isCrawler = crawlers.some((crawler) =>
    userAgent.toLowerCase().includes(crawler.toLowerCase())
  );

  const productMatch = req.path.match(/^\/product\/(.*)/);
  const planMatch = req.path.match(/^\/professional-plan\/(.*)/);

  if (isCrawler) {
    if (productMatch) {
      req.params.slug = productMatch[1];
      return shareRoutes.handleShareRequest(req, res, "product");
    }
    if (planMatch) {
      req.params.slug = planMatch[1];
      return shareRoutes.handleShareRequest(req, res, "professional-plan");
    }
  }
  next();
};

// --- Static Files ---
const __dirname1 = path.resolve();
app.use("/uploads", express.static(path.join(__dirname1, "/uploads")));

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname1, "/frontend/dist")));
  app.use(socialShareMiddleware);

  app.get("*", (req, res) =>
    res.sendFile(path.resolve(__dirname1, "frontend", "dist", "index.html"))
  );
} else {
  app.get("/", (req, res) => {
    res.send("API is running in development mode...");
  });
}

// --- Error Handling ---
app.use(notFound);
app.use(errorHandler);

// --- Server ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
