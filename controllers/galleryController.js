// controllers/galleryController.js

const asyncHandler = require("express-async-handler");
const Gallery = require("../models/galleryModel.js");
const fs = require("fs");

// @desc    Crear un nuevo item en la galería
// @route   POST /api/gallery
// @access  Private/Admin
const createGalleryItem = asyncHandler(async (req, res) => {
  // CHANGED: Added altText to destructuring
  const { title, category, relatedProduct, altText } = req.body;

  if (!title) {
    res.status(400);
    throw new Error("El título es obligatorio.");
  }

  if (!req.file) {
    res.status(400);
    throw new Error("La imagen es obligatoria.");
  }

  const galleryItem = new Gallery({
    title,
    // ADDED: altText is now saved with the item
    altText: altText || title, // Use altText if provided, otherwise fallback to title
    category,
    relatedProduct: relatedProduct || undefined,
    imageUrl: req.file.location, // Path from multer (e.g., S3 location)
  });

  const createdItem = await galleryItem.save();
  res.status(201).json(createdItem);
});

// @desc    Obtener todos los items de la galería
// @route   GET /api/gallery
// @access  Public
const getGalleryItems = asyncHandler(async (req, res) => {
  const galleryItems = await Gallery.find({}).sort({ createdAt: -1 });
  res.json(galleryItems);
});

// @desc    Eliminar un item de la galería
// @route   DELETE /api/gallery/:id
// @access  Private/Admin
const deleteGalleryItem = asyncHandler(async (req, res) => {
  const galleryItem = await Gallery.findById(req.params.id);

  if (galleryItem) {
    // NOTE: fs.unlinkSync will only work for local storage, not for cloud storage like S3.
    // For S3, you would need to use the AWS SDK to delete the object from the bucket.
    // This part is left as is, assuming your upload middleware handles deletion.

    await galleryItem.deleteOne();
    res.json({ message: "Imagen de la galería eliminada con éxito." });
  } else {
    res.status(404);
    throw new Error("Imagen no encontrada.");
  }
});

module.exports = {
  createGalleryItem,
  getGalleryItems,
  deleteGalleryItem,
};
