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

// Public routes
router.post("/register", upload.single("photo"), registerUser);
router.post("/login", loginUser);

// Admin protected routes
router.route("/").get(getAllUsers);

router.route("/:id").get(getUserById).put(updateUser).delete(deleteUser);

module.exports = router;
