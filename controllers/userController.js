const asyncHandler = require("express-async-handler");
const User = require("../models/userModel.js");
const jwt = require("jsonwebtoken");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

// ==========================================================
// ✨ BADLAV YAHAN HAI: Validation ko Model ke anusaar theek kiya gaya ✨
// ==========================================================
const validateRoleFields = (role, body) => {
  const {
    name,
    profession,
    businessName,
    address,
    city,
    materialType,
    companyName,
  } = body;

  switch (role) {
    case "user":
      if (!name) throw new Error("Full Name is required for Users");
      return { name, isApproved: true, status: "Approved" };

    case "professional":
      if (!name || !profession)
        throw new Error("Full Name and Profession are required");
      return { name, profession, isApproved: false, status: "Pending" };

    case "seller":
      if (!businessName || !address || !city || !materialType)
        throw new Error(
          "Business Name, Address, City, and Material Type are required"
        );
      return {
        businessName,
        address,
        city,
        materialType,
        isApproved: false,
        status: "Pending",
      };

    // 'partner' ko 'Contractor' se badla gaya aur validation theek kiya gaya
    case "Contractor":
      if (!name || !companyName || !address || !city)
        throw new Error(
          "Full Name, Company Name, Address, and City are required"
        );
      return {
        name, // Contractor ke liye 'name' bhi zaroori hai
        companyName,
        address,
        city,
        isApproved: false,
        status: "Pending",
      };

    case "admin":
      if (!name) throw new Error("Full Name is required for Admin");
      return { name, isApproved: true, status: "Approved" };

    default:
      throw new Error("Invalid role specified");
  }
};

const getUserDisplayName = (user) => {
  // Yeh logic abhi bhi sahi kaam karega kyunki 'name' ko prathmikta di gayi hai
  return user.name || user.businessName || user.companyName;
};

const registerUser = asyncHandler(async (req, res) => {
  const { email, password, phone, role } = req.body;
  if (!email || !password || !phone || !role) {
    res.status(400);
    throw new Error(
      "Please provide all required fields: email, password, phone, and role"
    );
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error("User with this email already exists");
  }

  let userData = { email, password, phone, role };
  try {
    const roleSpecificData = validateRoleFields(role, req.body);
    userData = { ...userData, ...roleSpecificData };

    // Sirf 'seller' ke liye registration ke time photo lega
    if (role === "seller" && req.file) {
      userData.photoUrl = req.file.path;
    }

    const user = await User.create(userData);

    res.status(201).json({
      _id: user._id,
      email: user.email,
      role: user.role,
      name: getUserDisplayName(user),
      isApproved: user.isApproved,
      status: user.status,
      photoUrl: user.photoUrl,
      profession: user.profession,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(400);
    throw error;
  }
});

const createUserByAdmin = asyncHandler(async (req, res) => {
  const { email, password, phone, role } = req.body;
  if (!email || !password || !phone || !role) {
    res.status(400);
    throw new Error("Email, password, phone, and role are required.");
  }
  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error("User with this email already exists");
  }
  let userData = { email, password, phone, role };
  try {
    const roleSpecificData = validateRoleFields(role, req.body);
    userData = { ...userData, ...roleSpecificData };
    userData.isApproved = true;
    userData.status = "Approved";
    const user = await User.create(userData);
    res.status(201).json({
      _id: user._id,
      email: user.email,
      role: user.role,
      name: getUserDisplayName(user),
    });
  } catch (error) {
    res.status(400);
    throw error;
  }
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400);
    throw new Error("Please provide email and password");
  }
  const user = await User.findOne({ email });
  if (user && (await user.matchPassword(password))) {
    res.json({
      _id: user._id,
      email: user.email,
      role: user.role,
      name: getUserDisplayName(user),
      isApproved: user.isApproved,
      status: user.status,
      profession: user.profession,
      businessName: user.businessName,
      companyName: user.companyName,
      photoUrl: user.photoUrl,
      token: generateToken(user._id),
    });
  } else {
    res.status(401);
    throw new Error("Invalid email or password");
  }
});

const getAllUsers = asyncHandler(async (req, res) => {
  const { role, status, page = 1, limit = 10 } = req.query;
  let filter = { role: { $ne: "admin" } }; // 'Admin' ko 'admin' kiya, case-insensitive ke liye
  if (role && role !== "all") filter.role = role;
  if (status && status !== "all") filter.status = status;
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const users = await User.find(filter)
    .select("-password")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit, 10));
  const totalUsers = await User.countDocuments(filter);
  res.json({
    users,
    pagination: {
      currentPage: parseInt(page, 10),
      totalPages: Math.ceil(totalUsers / parseInt(limit, 10)),
      totalUsers,
      hasNextPage: skip + users.length < totalUsers,
      hasPrevPage: parseInt(page, 10) > 1,
    },
  });
});

const getUserById = asyncHandler(async (req, res) => {
  if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
    res.status(400);
    throw new Error("Invalid user ID format");
  }
  const user = await User.findById(req.params.id).select("-password");
  if (user) {
    res.json(user);
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

const updateUser = asyncHandler(async (req, res) => {
  if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
    res.status(400);
    throw new Error("Invalid user ID format");
  }
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  if (user.role === "admin" && req.user.role !== "admin") {
    res.status(403);
    throw new Error("Access denied: Cannot update admin users");
  }

  user.name = req.body.name || user.name;
  user.email = req.body.email || user.email;
  user.phone = req.body.phone || user.phone;

  if (req.body.isApproved !== undefined) {
    user.isApproved = req.body.isApproved;
  }
  if (req.body.status) {
    user.status = req.body.status;
    if (req.body.status === "Approved") user.isApproved = true;
    if (["Pending", "Rejected"].includes(req.body.status))
      user.isApproved = false;
  }

  // Profile photo update logic
  if (req.file) {
    user.photoUrl = req.file.path;
  }

  if (user.role === "professional") {
    user.profession = req.body.profession || user.profession;
  } else if (user.role === "seller") {
    user.businessName = req.body.businessName || user.businessName;
    user.address = req.body.address || user.address;
    user.city = req.body.city || user.city;
    user.materialType = req.body.materialType || user.materialType;
  } else if (user.role === "Contractor") {
    // ✨ 'partner' ko 'Contractor' se badla gaya
    user.companyName = req.body.companyName || user.companyName;
    user.address = req.body.address || user.address;
    user.city = req.body.city || user.city;
  }

  const updatedUser = await user.save();
  res.json({
    _id: updatedUser._id,
    name: getUserDisplayName(updatedUser),
    email: updatedUser.email,
    phone: updatedUser.phone,
    role: updatedUser.role,
    isApproved: updatedUser.isApproved,
    status: updatedUser.status,
    profession: updatedUser.profession,
    businessName: updatedUser.businessName,
    companyName: updatedUser.companyName,
    address: updatedUser.address,
    city: updatedUser.city,
    materialType: updatedUser.materialType,
    photoUrl: updatedUser.photoUrl,
  });
});

const deleteUser = asyncHandler(async (req, res) => {
  if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
    res.status(400);
    throw new Error("Invalid user ID format");
  }
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  if (user.role === "admin") {
    res.status(400);
    throw new Error("Cannot delete an admin user");
  }
  await User.findByIdAndDelete(req.params.id);
  res.json({
    message: "User removed successfully",
    deletedUser: {
      _id: user._id,
      name: getUserDisplayName(user),
      email: user.email,
      role: user.role,
    },
  });
});

const getUserStats = asyncHandler(async (req, res) => {
  const stats = await User.aggregate([
    { $match: { role: { $ne: "admin" } } },
    {
      $group: {
        _id: "$role",
        count: { $sum: 1 },
        approved: { $sum: { $cond: [{ $eq: ["$isApproved", true] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] } }, // isApproved se status par switch kiya
      },
    },
  ]);
  const totalUsers = await User.countDocuments({ role: { $ne: "admin" } });
  res.json({ totalUsers, breakdown: stats });
});

module.exports = {
  registerUser,
  loginUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserStats,
  createUserByAdmin,
};
