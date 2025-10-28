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
} = require("../controllers/sellerProductController.js");

// --- YAHAN BADLAAV KIYA GAYA HAI ---
// `professionalProtect` ki jagah `sellerProtect` ko import karein
const { protect, sellerProtect } = require("../middleware/authMiddleware.js");
// ------------------------------------

const upload = require("../middleware/uploadMiddleware.js");

const handleFileUploads = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "images", maxCount: 5 },
]);
router.get("/brands", protect, sellerProtect, getUniqueBrands);
router.get("/categories", protect, sellerProtect, getUniqueCategories);

router
  .route("/")
  .get(protect, sellerProtect, getMyProducts)
  .post(protect, sellerProtect, handleFileUploads, createSellerProduct);

router
  .route("/:id")
  .put(protect, sellerProtect, handleFileUploads, updateMyProduct)
  .delete(protect, sellerProtect, deleteMyProduct);
router.get("/public/all", getAllPublicProducts);

module.exports = router;
