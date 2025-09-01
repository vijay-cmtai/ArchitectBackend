// models/professionalPlanModel.js

const mongoose = require("mongoose");

const reviewSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    rating: { type: Number, required: true },
    comment: { type: String, required: true },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

const professionalPlanSchema = mongoose.Schema(
  {
    // ++ CAMPO MODIFICADO ++ (para coincidir con Product)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    // ++ CAMPO MODIFICADO ++ (para coincidir con Product)
    name: {
      type: String,
      required: [true, "Plan name is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
    },

    // ++ NUEVO CAMPO AÑADIDO ++
    productNo: {
      type: String,
      required: [true, "Product Number is required"],
      unique: true, // Asegura que cada número de producto sea único
    },

    plotSize: { type: String, required: true },
    plotArea: { type: Number, required: true },
    rooms: { type: Number, required: true, default: 0 },
    bathrooms: { type: Number, default: 0 },
    kitchen: { type: Number, default: 0 },
    floors: { type: Number, default: 1 },
    direction: {
      type: String,
      enum: [
        "North",
        "South",
        "East",
        "West",
        "North-East",
        "North-West",
        "South-East",
        "South-West",
      ],
    },

    // ++ NUEVO CAMPO AÑADIDO ++
    city: {
      type: [String], // Permite múltiples ciudades
      required: true,
    },

    // ++ CAMPO MODIFICADO ++ (de String a Array de Strings)
    country: { type: [String], required: true },
    planType: {
      type: String,
      required: true,
      enum: [
        "Floor Plans",
        "Floor Plan + 3D Elevations", // Opción añadida para coincidir
        "Interior Designs",
        "Construction Products",
      ],
    },
    price: { type: Number, required: true, default: 0 },

    // ++ NUEVOS CAMPOS AÑADIDOS ++
    salePrice: { type: Number, default: 0 },
    isSale: { type: Boolean, default: false },
    propertyType: { type: String, enum: ["Residential", "Commercial"] },

    category: { type: String, required: true },
    status: {
      type: String,
      enum: ["Published", "Pending Review", "Draft"],
      default: "Pending Review", // Coincide con Product
    },
    mainImage: { type: String, required: true },
    galleryImages: [{ type: String }],

    // ++ CAMPO MODIFICADO ++ (de String a Array de Strings)
    planFile: { type: [String], required: true },

    // ++ NUEVO CAMPO AÑADIDO ++
    headerImage: { type: String },

    youtubeLink: { type: String, trim: true },
    rating: { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 },
    reviews: [reviewSchema],
  },
  {
    timestamps: true,
  }
);

professionalPlanSchema.pre("save", function (next) {
  if (this.isModified("reviews")) {
    const totalRating = this.reviews.reduce(
      (acc, item) => item.rating + acc,
      0
    );
    this.numReviews = this.reviews.length;
    this.rating = this.numReviews > 0 ? totalRating / this.numReviews : 0;
  }
  next();
});

const ProfessionalPlan = mongoose.model(
  "ProfessionalPlan",
  professionalPlanSchema
);

module.exports = ProfessionalPlan;
