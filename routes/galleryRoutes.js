// routes/galleryRoutes.js

const express = require("express");
const router = express.Router();
const {
  createGalleryItem,
  getGalleryItems,
  deleteGalleryItem,
} = require("../controllers/galleryController.js");

// Middleware de autenticación (suponiendo que tienes uno)
const { protect, admin } = require("../middleware/authMiddleware"); // Ajusta la ruta a tu middleware

// --- CORRECCIÓN AQUÍ ---
// Importamos directamente el middleware exportado a la variable 'upload'.
// ANTES: const { uploadGalleryImage } = require("../middleware/uploadMiddleware");
const upload = require("../middleware/uploadMiddleware");

// Ruta para obtener todas las imágenes y para subir una nueva
router
  .route("/")
  .get(getGalleryItems) // Ruta pública para ver la galería
  .post(
    protect, // Proteger la ruta
    admin, // Solo los administradores pueden subir
    // --- CORRECCIÓN AQUÍ ---
    // Usamos la variable 'upload' que acabamos de importar.
    upload.single("image"), // 'image' es el nombre del campo en el formulario
    createGalleryItem
  );

// Ruta para eliminar una imagen específica por su ID
router.route("/:id").delete(protect, admin, deleteGalleryItem);

module.exports = router;
