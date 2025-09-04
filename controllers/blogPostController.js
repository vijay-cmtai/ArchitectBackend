const asyncHandler = require("express-async-handler");
const BlogPost = require("../models/blogPostModel.js");

const formatSlug = (slug) => {
  if (!slug) return "";
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
};

const processStringToArray = (str) => {
  if (!str || typeof str !== "string") return [];
  return str
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const getPublishedPosts = asyncHandler(async (req, res) => {
  const posts = await BlogPost.find({ status: "Published" }).sort({
    createdAt: -1,
  });
  res.json(posts);
});

const getPostBySlug = asyncHandler(async (req, res) => {
  const post = await BlogPost.findOne({ slug: req.params.slug });
  if (post) {
    res.json(post);
  } else {
    res.status(404);
    throw new Error("Blog post not found");
  }
});

const getAllPostsAdmin = asyncHandler(async (req, res) => {
  const posts = await BlogPost.find({}).sort({ createdAt: -1 });
  res.json(posts);
});

// ✅ CREATE POST UPDATED
const createPost = asyncHandler(async (req, res) => {
  const {
    title,
    slug,
    description,
    content,
    author,
    status,
    tags,
    h1Text, // Naya field yahan add kiya
    metaDescription,
    metaKeywords,
    imageAltText,
    imageTitleText,
  } = req.body;

  // Validation
  if (!title || !slug || !description || !content || !imageAltText) {
    res.status(400);
    throw new Error(
      "Title, Slug, Description, Content, and Image Alt Text are required."
    );
  }
  if (!req.file) {
    res.status(400);
    throw new Error("A main image for the blog post is required.");
  }

  // Check for unique slug
  const formattedSlug = formatSlug(slug);
  const slugExists = await BlogPost.findOne({ slug: formattedSlug });
  if (slugExists) {
    res.status(400);
    throw new Error("This slug is already in use. Please choose a unique one.");
  }

  // Process tags and keywords from string to array
  const processedTags = processStringToArray(tags);
  const processedKeywords = processStringToArray(metaKeywords);

  // Create new blog post instance
  const post = new BlogPost({
    title,
    slug: formattedSlug,
    description,
    content,
    author: author || "Admin",
    status: status || "Draft",
    mainImage: req.file.path,
    tags: processedTags,
    h1Text, // Naya field save karein
    metaDescription,
    metaKeywords: processedKeywords,
    imageAltText,
    imageTitleText,
  });

  const createdPost = await post.save();
  res.status(201).json(createdPost);
});

// ✅ UPDATE POST UPDATED
const updatePost = asyncHandler(async (req, res) => {
  const {
    title,
    slug,
    description,
    content,
    author,
    status,
    tags,
    h1Text, // Naya field yahan add kiya
    metaDescription,
    metaKeywords,
    imageAltText,
    imageTitleText,
  } = req.body;

  const post = await BlogPost.findById(req.params.id);

  if (post) {
    post.title = title || post.title;
    post.description = description || post.description;
    post.content = content || post.content;
    post.author = author || post.author;
    post.status = status || post.status;

    // Naye fields ko conditionally update karein taaki empty string bhi save ho sake
    if ("h1Text" in req.body) post.h1Text = h1Text;
    if ("metaDescription" in req.body) post.metaDescription = metaDescription;
    if ("imageAltText" in req.body) post.imageAltText = imageAltText;
    if ("imageTitleText" in req.body) post.imageTitleText = imageTitleText;

    if (slug) {
      const formattedSlug = formatSlug(slug);
      if (formattedSlug !== post.slug) {
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
    }

    if (req.file) {
      post.mainImage = req.file.path;
    }

    if ("tags" in req.body) {
      post.tags = processStringToArray(tags);
    }
    if ("metaKeywords" in req.body) {
      post.metaKeywords = processStringToArray(metaKeywords);
    }

    const updatedPost = await post.save();
    res.json(updatedPost);
  } else {
    res.status(404);
    throw new Error("Blog post not found");
  }
});

const deletePost = asyncHandler(async (req, res) => {
  const post = await BlogPost.findById(req.params.id);

  if (post) {
    await post.deleteOne();
    res.json({ message: "Blog post removed successfully" });
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
