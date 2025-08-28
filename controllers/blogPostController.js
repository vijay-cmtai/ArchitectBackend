// controllers/blogPostController.js

const asyncHandler = require("express-async-handler");
const BlogPost = require("../models/blogPostModel.js");

// Helper function to format slug
const formatSlug = (slug) => {
  if (!slug) return "";
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // remove invalid chars
    .replace(/\s+/g, "-") // collapse whitespace and replace by -
    .replace(/-+/g, "-"); // collapse dashes
};

// @desc    Fetch all published blog posts
// @route   GET /api/blogs
// @access  Public
const getPublishedPosts = asyncHandler(async (req, res) => {
  const posts = await BlogPost.find({ status: "Published" }).sort({
    createdAt: -1,
  });
  res.json(posts);
});

// @desc    Fetch a single blog post by slug
// @route   GET /api/blogs/slug/:slug
// @access  Public
const getPostBySlug = asyncHandler(async (req, res) => {
  const post = await BlogPost.findOne({ slug: req.params.slug });
  if (post) {
    res.json(post);
  } else {
    res.status(404);
    throw new Error("Blog post not found");
  }
});

// --- ADMIN ONLY ---

// @desc    Fetch ALL posts (published and drafts) for admin
// @route   GET /api/blogs/all
// @access  Private/Admin
const getAllPostsAdmin = asyncHandler(async (req, res) => {
  const posts = await BlogPost.find({}).sort({ createdAt: -1 });
  res.json(posts);
});

// @desc    Create a new blog post
// @route   POST /api/blogs
// @access  Private/Admin
const createPost = asyncHandler(async (req, res) => {
  let { title, slug, description, content, author, status } = req.body;

  if (!title || !slug || !description || !content) {
    res.status(400);
    throw new Error("Title, Slug, Description, and Content are required.");
  }
  if (!req.file) {
    res.status(400);
    throw new Error("Main image is required.");
  }

  const formattedSlug = formatSlug(slug);
  const slugExists = await BlogPost.findOne({ slug: formattedSlug });
  if (slugExists) {
    res.status(400);
    throw new Error("This slug is already in use. Please choose a unique one.");
  }

  const post = new BlogPost({
    title,
    slug: formattedSlug,
    description,
    content,
    author: author || "Admin",
    status: status || "Draft",
    mainImage: req.file.path,
  });

  const createdPost = await post.save();
  res.status(201).json(createdPost);
});

// @desc    Update a blog post
// @route   PUT /api/blogs/:id
// @access  Private/Admin
const updatePost = asyncHandler(async (req, res) => {
  const { title, slug, description, content, author, status } = req.body;
  const post = await BlogPost.findById(req.params.id);

  if (post) {
    post.title = title || post.title;
    post.description = description || post.description;
    post.content = content || post.content;
    post.author = author || post.author;
    post.status = status || post.status;

    if (slug) {
      const formattedSlug = formatSlug(slug);
      // Check if another post is already using the new slug
      const slugExists = await BlogPost.findOne({
        slug: formattedSlug,
        _id: { $ne: req.params.id },
      });
      if (slugExists) {
        res.status(400);
        throw new Error("This slug is already in use by another post.");
      }
      post.slug = formattedSlug;
    }

    if (req.file) {
      post.mainImage = req.file.path;
    }

    const updatedPost = await post.save();
    res.json(updatedPost);
  } else {
    res.status(404);
    throw new Error("Blog post not found");
  }
});

// @desc    Delete a blog post
// @route   DELETE /api/blogs/:id
// @access  Private/Admin
const deletePost = asyncHandler(async (req, res) => {
  const post = await BlogPost.findById(req.params.id);
  if (post) {
    await post.deleteOne();
    res.json({ message: "Blog post removed" });
  } else {
    res.status(404);
    throw new Error("Blog post not found");
  }
});

module.exports = {
  getPublishedPosts,
  getPostBySlug,
  getAllPostsAdmin,
  createPost,
  updatePost,
  deletePost,
};
