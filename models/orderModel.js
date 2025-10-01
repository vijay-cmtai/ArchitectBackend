const mongoose = require("mongoose");

// Helper function to generate a unique order ID using nanoid
const generateOrderId = async () => {
  // Dynamically import the nanoid library which is an ES Module
  const { customAlphabet } = await import("nanoid");

  // Define the alphabet and length for the ID
  const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", 8);

  // Return the formatted ID
  return `HPF-${nanoid()}`;
};

const orderSchema = mongoose.Schema(
  {
    // User is now OPTIONAL for guest checkouts
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    // Public-facing, unique ID for guests to track their order
    orderId: {
      type: String,
      unique: true,
      index: true,
    },
    // Stores the URLs of files the user can download after payment
    downloadableFiles: [
      {
        productName: { type: String, required: true },
        fileUrl: { type: String, required: true },
      },
    ],
    orderItems: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
          ref: "Product",
        },
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        image: { type: String },
        size: { type: String },
      },
    ],
    shippingAddress: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      location: { type: String, required: false },
    },
    paymentMethod: {
      type: String,
      required: [true, "Payment method is required"],
    },
    paymentResult: {
      id: { type: String },
      status: { type: String },
      update_time: { type: String },
      email_address: { type: String },
    },
    itemsPrice: { type: Number, required: true, default: 0.0 },
    taxPrice: { type: Number, required: true, default: 0.0 },
    shippingPrice: { type: Number, required: true, default: 0.0 },
    totalPrice: { type: Number, required: true, default: 0.0 },
    isPaid: { type: Boolean, required: true, default: false },
    paidAt: { type: Date },
    merchantTransactionId: { type: String }, // For PhonePe
  },
  {
    timestamps: true,
  }
);

// Mongoose pre-save hook to generate the unique orderId before saving a new document
orderSchema.pre("save", async function (next) {
  // Check if the document is new and if the orderId has not been set yet
  if (this.isNew && !this.orderId) {
    this.orderId = await generateOrderId();
  }
  next(); // Continue with the save operation
});

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
