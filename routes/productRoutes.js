const express = require("express");
const router = express.Router();
const {
  getProducts,
  getProductById,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
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
  { name: "planFile", maxCount: 10 },
  { name: "headerImage", maxCount: 1 },
]);

router.route("/").get(getProducts);
router.route("/slug/:slug").get(getProductBySlug);
router.route("/:id").get(getProductById);

router
  .route("/")
  .post(protect, professionalOrAdminProtect, handleFileUploads, createProduct);

router
  .route("/:id")
  .put(protect, professionalOrAdminProtect, handleFileUploads, updateProduct)
  .delete(protect, professionalOrAdminProtect, deleteProduct);

router.route("/:id/reviews").post(protect, createProductReview);

module.exports = router;
