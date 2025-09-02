// routes/userRoutes.js

const express = require("express");
const {
  registerUser,
  loginUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
} = require("../controllers/userController");

const upload = require("../middleware/uploadMiddleware");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

// ++ CHANGE HERE: The middleware now accepts multiple specific file fields
const handleUserUploads = upload.fields([
  { name: "photo", maxCount: 1 },
  { name: "businessCertification", maxCount: 1 },
  { name: "shopImage", maxCount: 1 },
]);

// Public routes
// ++ CHANGE HERE: The register route now uses the new multi-field upload handler
router.post("/register", handleUserUploads, registerUser);
router.post("/login", loginUser);

// Admin protected routes
router.route("/").get(getAllUsers);
router.route("/:id").get(getUserById).put(updateUser).delete(deleteUser);

module.exports = router;
