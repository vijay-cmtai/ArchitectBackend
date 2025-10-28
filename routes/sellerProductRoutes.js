const express = require("express");
const router = express.Router();
const {
  createSellerProduct,
  getMyProducts,
  updateMyProduct,
  deleteMyProduct,
  getUniqueBrands,
  getUniqueCategories,
  getAllPublicProducts,
  getAllProductsForAdmin,
} = require("../controllers/sellerProductController.js");

const {
  protect,
  sellerProtect,
  admin,
} = require("../middleware/authMiddleware.js");
const upload = require("../middleware/uploadMiddleware.js");

const handleFileUploads = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "images", maxCount: 5 },
]);

router.get("/public/all", getAllPublicProducts);

router.route("/admin/all").get(protect, admin, getAllProductsForAdmin);

router.get("/brands", protect, sellerProtect, getUniqueBrands);
router.get("/categories", protect, sellerProtect, getUniqueCategories);

router
  .route("/")
  .get(protect, sellerProtect, getMyProducts)
  .post(protect, sellerProtect, handleFileUploads, createSellerProduct);

router
  .route("/:id")
  .put(protect, handleFileUploads, updateMyProduct)
  .delete(protect, deleteMyProduct);

module.exports = router;
