const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Notification = require("./notificationModel");

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
    isApproved: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    photoUrl: { type: String },
    profession: { type: String },
    businessCertificationUrl: { type: String },
    shopImageUrl: { type: String },
    city: { type: String },
    address: { type: String },
    experience: { type: String },
    businessName: { type: String },
    materialType: { type: String },
    companyName: { type: String },
    contractorType: {
      type: String,
      enum: ["Normal", "Premium"],
      default: "Normal",
    },

    // --- NEW: Professional Bank & Payment Details ---
    bankName: { type: String }, // <--- ADDED: Bank Name Field
    bankAccountNumber: { type: String },
    ifscCode: { type: String },
    upiId: { type: String },
    portfolioUrl: { type: String }, // Portfolio PDF URL

    passwordResetToken: String,
    passwordResetExpires: Date,
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

userSchema.post("save", async function (doc, next) {
  if (this.isNew) {
    try {
      await Notification.create({
        message: `New ${doc.role} registered: ${doc.name || doc.email}`,
        type: "NEW_USER",
        link: "/admin/users",
      });
    } catch (error) {
      console.error("Failed to create notification for new user:", error);
    }
  }
  next();
});

const User = mongoose.model("User", userSchema);

module.exports = User;
