// models/userModel.js

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ["user", "professional", "seller", "Contractor", "admin"],
    },
    name: { type: String }, // For User, Professional, Admin, Contractor

    // Approval Status
    isApproved: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },

    // Profile Image
    photoUrl: { type: String },

    // For Professional
    profession: { type: String },

    // For Seller
    businessName: { type: String },
    materialType: { type: String },

    // For Contractor
    companyName: { type: String },
    // ++ CHANGE HERE: Added experience field for contractors
    experience: { type: String },

    // Common for Seller and Contractor
    address: { type: String },
    city: { type: String },
  },
  {
    timestamps: true,
  }
);

// Password hashing and matching logic
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.model("User", userSchema);

module.exports = User;
