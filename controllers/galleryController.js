// controllers/galleryController.js

const asyncHandler = require("express-async-handler");
const Gallery = require("../models/galleryModel.js");
const fs = require("fs"); // Módulo File System de Node.js para eliminar archivos

// @desc    Crear un nuevo item en la galería
// @route   POST /api/gallery
// @access  Private/Admin
const createGalleryItem = asyncHandler(async (req, res) => {
  const { title, category, relatedProduct } = req.body;

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
    category,
    relatedProduct: relatedProduct || undefined,
    imageUrl: req.file.path, // La ruta del archivo subido por multer
  });

  const createdItem = await galleryItem.save();
  res.status(201).json(createdItem);
});

// @desc    Obtener todos los items de la galería
// @route   GET /api/gallery
// @access  Public
const getGalleryItems = asyncHandler(async (req, res) => {
  // Opcional: puedes filtrar por categoría o producto si lo necesitas
  // const { category } = req.query;
  // const filter = category ? { category } : {};
  const galleryItems = await Gallery.find({}).sort({ createdAt: -1 });
  res.json(galleryItems);
});

// @desc    Eliminar un item de la galería
// @route   DELETE /api/gallery/:id
// @access  Private/Admin
const deleteGalleryItem = asyncHandler(async (req, res) => {
  const galleryItem = await Gallery.findById(req.params.id);

  if (galleryItem) {
    // Eliminar el archivo de imagen del servidor
    try {
      if (fs.existsSync(galleryItem.imageUrl)) {
        fs.unlinkSync(galleryItem.imageUrl);
      }
    } catch (err) {
      console.error("Error al eliminar el archivo de imagen:", err);
      // No detenemos el proceso, solo lo registramos. La eliminación de la DB es más importante.
    }

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
