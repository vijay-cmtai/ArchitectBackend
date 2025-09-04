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
    h1Text: {
      type: String,
      trim: true,
    },
    metaDescription: {
      type: String, // Search engine mein dikhne wala description (150-160 chars)
      trim: true,
    },
    metaKeywords: {
      type: [String], 
      default: [],
    },

    // --- Image Attribute Fields ---
    imageAltText: {
      type: String, 
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
