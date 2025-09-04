const mongoose = require("mongoose");

const blogPostSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      unique: true,
      index: true,
    },
    description: {
      // Yeh blog ka short summary hai
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    author: {
      type: String,
      required: true,
      default: "Admin",
    },
    mainImage: {
      // Yeh image ka path/URL hai
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["Published", "Draft"],
      default: "Draft",
    },
    tags: {
      type: [String],
      default: [],
    },

    // ===============================================
    // ✅ NAYE FIELDS YAHAN ADD KIYE GAYE HAIN
    // ===============================================

    // --- SEO Fields ---
    metaDescription: {
      type: String, // Search engine mein dikhne wala description (150-160 chars)
      trim: true,
    },
    metaKeywords: {
      type: [String], // SEO ke liye keywords ka array
      default: [],
    },

    // --- Image Attribute Fields ---
    imageAltText: {
      type: String, // Image ka alt text (Accessibility aur SEO ke liye bahut zaroori)
      required: [true, "Image alt text is required for accessibility."],
      trim: true,
    },
    imageTitleText: {
      type: String, // Image par hover karne par dikhne wala title text
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const BlogPost = mongoose.model("BlogPost", blogPostSchema);

module.exports = BlogPost;
