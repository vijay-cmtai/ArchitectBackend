const mongoose = require("mongoose");

const generateOrderId = async () => {
  const { customAlphabet } = await import("nanoid");
  const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", 8);
  return `HPF-${nanoid()}`;
};

const orderSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    orderId: {
      type: String,
      unique: true,
      index: true,
    },
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
        professional: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
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
    merchantTransactionId: { type: String },
  },
  {
    timestamps: true,
  }
);

orderSchema.pre("save", async function (next) {
  if (this.isNew && !this.orderId) {
    this.orderId = await generateOrderId();
  }
  next();
});

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
