// File: routes/admin/productRoutes.js

const express = require("express");
const router = express.Router();
const {
  getProducts,
  getAdminProducts,
  getMyProducts,
  getProductById,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  createProductReview,
  removeCsvImage,
} = require("../controllers/admin/productController.js");
const {
  protect,
  admin,
  professionalOrAdminProtect,
} = require("../middleware/authMiddleware.js");
const upload = require("../middleware/uploadMiddleware.js");

const handleFileUploads = upload.fields([
  { name: "mainImage", maxCount: 1 },
  { name: "galleryImages", maxCount: 5 },
  { name: "planFile", maxCount: 10 },
  { name: "headerImage", maxCount: 1 },
]);

router.route("/slug/:slug").get(getProductBySlug);

router
  .route("/")
  .get(getProducts)
  .post(protect, professionalOrAdminProtect, handleFileUploads, createProduct);

router.route("/admin").get(protect, admin, getAdminProducts);

router
  .route("/myproducts")
  .get(protect, professionalOrAdminProtect, getMyProducts);

router
  .route("/:id")
  .get(getProductById)
  .put(protect, professionalOrAdminProtect, handleFileUploads, updateProduct)
  .delete(protect, professionalOrAdminProtect, deleteProduct);

router.route("/:id/reviews").post(protect, createProductReview);

router
  .route("/:id/csv-image")
  .delete(protect, professionalOrAdminProtect, removeCsvImage);

module.exports = router;
