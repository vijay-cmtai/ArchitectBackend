const asyncHandler = require("express-async-handler");
const Gallery = require("../models/galleryModel.js");

const createGalleryItems = asyncHandler(async (req, res) => {
  const { title, category, relatedProduct, altText, productLink } = req.body;

  if (!req.files || req.files.length === 0) {
    res.status(400);
    throw new Error("At least one image is required.");
  }

  const galleryItemsToCreate = req.files.map((file) => {
    return {
      title: title || file.originalname,
      altText: altText || title || file.originalname,
      imageUrl: file.location,
      category,
      relatedProduct: relatedProduct || undefined,
      productLink: productLink || "",
    };
  });

  const createdItems = await Gallery.insertMany(galleryItemsToCreate);

  res.status(201).json(createdItems);
});

const getGalleryItems = asyncHandler(async (req, res) => {
  const galleryItems = await Gallery.find({}).sort({ createdAt: -1 });
  res.json(galleryItems);
});

const deleteGalleryItem = asyncHandler(async (req, res) => {
  const galleryItem = await Gallery.findById(req.params.id);

  if (galleryItem) {
    await galleryItem.deleteOne();
    res.json({ message: "Gallery image removed successfully." });
  } else {
    res.status(404);
    throw new Error("Image not found.");
  }
});

module.exports = {
  createGalleryItems,
  getGalleryItems,
  deleteGalleryItem,
};
