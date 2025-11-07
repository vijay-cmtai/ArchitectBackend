const mongoose = require("mongoose");

const notificationSchema = mongoose.Schema(
  {
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "NEW_USER",
        "NEW_CORPORATE_INQUIRY",
        "NEW_CUSTOMIZATION_REQUEST",
        "NEW_SELLER_INQUIRY",
        "NEW_STANDARD_REQUEST",
      ],
    },
    link: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;
