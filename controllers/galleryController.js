const asyncHandler = require("express-async-handler");
const Gallery = require("../models/galleryModel.js");

// @desc    Create a new gallery item
// @route   POST /api/gallery
// @access  Private/Admin
const createGalleryItem = asyncHandler(async (req, res) => {
  // --- ✨ productLink has been added here ---
  const { title, category, relatedProduct, altText, productLink } = req.body;

  if (!title) {
    res.status(400);
    throw new Error("Title is required."); // Message in English
  }

  if (!req.file) {
    res.status(400);
    throw new Error("Image is required."); // Message in English
  }

  const galleryItem = new Gallery({
    title,
    altText: altText || title,
    category,
    relatedProduct: relatedProduct || undefined,
    imageUrl: req.file.location, // URL from S3
    // --- ✨ productLink is being saved here ---
    productLink: productLink || "", // Save empty string if no link is provided
  });

  const createdItem = await galleryItem.save();
  res.status(201).json(createdItem);
});

// @desc    Get all gallery items
// @route   GET /api/gallery
// @access  Public
const getGalleryItems = asyncHandler(async (req, res) => {
  const galleryItems = await Gallery.find({}).sort({ createdAt: -1 });
  res.json(galleryItems);
});

// @desc    Delete a gallery item
// @route   DELETE /api/gallery/:id
// @access  Private/Admin
const deleteGalleryItem = asyncHandler(async (req, res) => {
  const galleryItem = await Gallery.findById(req.params.id);

  if (galleryItem) {
    // Logic for deleting the image from S3 would go here if needed
    await galleryItem.deleteOne();
    res.json({ message: "Gallery image removed successfully." }); // Message in English
  } else {
    res.status(404);
    throw new Error("Image not found."); // Message in English
  }
});

module.exports = {
  createGalleryItem,
  getGalleryItems,
  deleteGalleryItem,
};
