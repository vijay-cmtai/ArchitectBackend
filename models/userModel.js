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
    name: { type: String },

    // Approval Status
    isApproved: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },

    // Profile Image
    photoUrl: { type: String },

    // Fields for Professional, Seller & Contractor
    profession: { type: String },
    businessCertificationUrl: { type: String },
    shopImageUrl: { type: String },
    city: { type: String },
    address: { type: String },
    experience: { type: String }, // Added for Professional and Contractor

    // For Seller
    businessName: { type: String },
    materialType: { type: String },

    // For Contractor
    companyName: { type: String },
  },
  {
    timestamps: true,
  }
);

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
