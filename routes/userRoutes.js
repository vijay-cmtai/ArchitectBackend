const express = require("express");
const {
  registerUser,
  loginUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  createUserByAdmin,
  getUserStats,
  getSellerPublicProfile,
  forgotPassword,
  resetPassword,
} = require("../controllers/userController");

const upload = require("../middleware/uploadMiddleware");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

const handleUserUploads = upload.fields([
  { name: "photo", maxCount: 1 },
  { name: "businessCertification", maxCount: 1 },
  { name: "shopImage", maxCount: 1 },
  { name: "portfolio", maxCount: 1 }, // NEW: Portfolio PDF for professionals
]);

router.post("/register", handleUserUploads, registerUser);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.put("/reset-password/:token", resetPassword);
router.get("/store/:sellerId", getSellerPublicProfile);
router.route("/").get(getAllUsers);

router
  .route("/admin/create")
  .post(protect, admin, handleUserUploads, createUserByAdmin);
router.route("/stats").get(protect, admin, getUserStats);

router
  .route("/:id")
  .get(protect, admin, getUserById)
  .put(protect, handleUserUploads, updateUser)
  .delete(protect, admin, deleteUser);

module.exports = router;
