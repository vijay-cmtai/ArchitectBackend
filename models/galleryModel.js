const mongoose = require("mongoose");

const gallerySchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "El título de la imagen es requerido"],
      trim: true,
    },
    altText: {
      type: String,
      trim: true,
      default: "",
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
    relatedProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: false,
    },
    productLink: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const Gallery = mongoose.model("Gallery", gallerySchema);

module.exports = Gallery;
