const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../models/userModel.js");

const protect = asyncHandler(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        res.status(401);
        throw new Error("User not found for this token");
      }

      next();
    } catch (error) {
      console.error("TOKEN ERROR:", error.message);
      res.status(401);
      throw new Error("Not authorized, token failed");
    }
  }

  if (!token) {
    res.status(401);
    throw new Error("Not authorized, no token");
  }
});

const admin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403); // 403 Forbidden
    throw new Error("Not authorized as an admin");
  }
};

// Middleware 3: Check if user is a Professional (and is Approved)
const professionalProtect = (req, res, next) => {
  if (req.user && req.user.role === "professional") {
    // ✨ Approval ka check ab yahan hoga ✨
    if (!req.user.isApproved) {
      res.status(403); // 403 Forbidden
      throw new Error(
        "Access Denied. Your professional account is pending admin approval."
      );
    }
    next(); 
  } else {
    res.status(403);
    throw new Error("Not authorized. This action is for professionals only.");
  }
};

const professionalOrAdminProtect = (req, res, next) => {
  if (
    req.user &&
    (req.user.role === "professional" || req.user.role === "admin")
  ) {
    if (req.user.role === "professional" && !req.user.isApproved) {
      res.status(403);
      throw new Error(
        "Access Denied. Your professional account is pending admin approval."
      );
    }
    next();
  } else {
    res.status(403);
    throw new Error(
      "Not authorized. Only Professionals or Admins can perform this action."
    );
  }
};

module.exports = {
  protect,
  admin,
  professionalProtect,
  professionalOrAdminProtect,
};
