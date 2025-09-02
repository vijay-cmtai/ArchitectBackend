// models/galleryModel.js

const mongoose = require("mongoose");

const gallerySchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "El título de la imagen es requerido"],
      trim: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      trim: true,
      default: "General",
    },
    // Opcional: Para relacionar esta imagen con un producto específico
    relatedProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product", // Asegúrate de que 'Product' es el nombre de tu modelo de productos
      required: false, // Hazlo opcional si quieres una galería general
    },
  },
  {
    timestamps: true,
  }
);

const Gallery = mongoose.model("Gallery", gallerySchema);

module.exports = Gallery;
