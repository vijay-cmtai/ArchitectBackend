// models/videoModel.js
const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    // Title ab admin khud daalega
    title: {
      type: String,
      required: [true, "Please provide a title"],
      trim: true,
    },
    // Hum poora YouTube link save karenge
    youtubeLink: {
      type: String,
      required: [true, "Please provide a YouTube link"],
      trim: true,
    },
    // Topic waise hi rahega
    topic: {
      type: String,
      required: [true, "Please provide a topic"],
      trim: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const Video = mongoose.model("Video", videoSchema);
module.exports = Video;
