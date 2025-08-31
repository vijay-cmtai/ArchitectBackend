// routes/productRoutes.js

const express = require("express");
const router = express.Router();
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  // ++ CHANGE HERE: Import the new controller function
  createProductReview,
} = require("../controllers/admin/productController.js");
const {
  protect,
  professionalOrAdminProtect,
} = require("../middleware/authMiddleware.js");
const upload = require("../middleware/uploadMiddleware.js");

const handleFileUploads = upload.fields([
  { name: "mainImage", maxCount: 1 },
  { name: "galleryImages", maxCount: 5 },
  { name: "planFile", maxCount: 1 },
]);

// --- Public Routes ---
router.route("/").get(getProducts);
router.route("/:id").get(getProductById);

// --- Protected Routes for Creating/Editing Products ---
router
  .route("/")
  .post(protect, professionalOrAdminProtect, handleFileUploads, createProduct);

router
  .route("/:id")
  .put(protect, professionalOrAdminProtect, handleFileUploads, updateProduct)
  .delete(protect, professionalOrAdminProtect, deleteProduct);

// --- ++ NEW ROUTE TO ADD REVIEWS ++ ---
// This route allows any logged-in user ('protect') to add a review to a specific product.
router.route("/:id/reviews").post(protect, createProductReview);

module.exports = router;
