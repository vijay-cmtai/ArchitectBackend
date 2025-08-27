const express = require("express");
const router = express.Router();
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/admin/productController.js");
const {
  protect,
  professionalOrAdminProtect,
} = require("../middleware/authMiddleware.js");
const upload = require("../middleware/uploadMiddleware.js");

// --- ✨ THE FIX IS HERE: Use the correct field names ✨ ---
const handleFileUploads = upload.fields([
  { name: "mainImage", maxCount: 1 }, // Was 'image'
  { name: "galleryImages", maxCount: 5 }, // Was 'images'
  { name: "planFile", maxCount: 1 },
]);
// --- END OF FIX ---

// Public routes
router.route("/").get(getProducts);
router.route("/:id").get(getProductById);

// Protected routes
router
  .route("/")
  .post(protect, professionalOrAdminProtect, handleFileUploads, createProduct);

router
  .route("/:id")
  .put(protect, professionalOrAdminProtect, handleFileUploads, updateProduct)
  .delete(protect, professionalOrAdminProtect, deleteProduct);

module.exports = router;
