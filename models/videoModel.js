// models/videoModel.js
const mongoose = require("mongoose");

// Helper function to extract YouTube video ID from URL
const extractYouTubeId = (url) => {
  if (!url) return null;
  // This regex is robust and covers most YouTube URL formats
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

const videoSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    title: {
      type: String,
      required: [true, "Please provide a title"],
      trim: true,
    },
    youtubeLink: {
      type: String,
      required: [true, "Please provide a YouTube link"],
      trim: true,
    },
    youtubeVideoId: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values, but unique non-null values
    },
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

// Pre-save middleware to extract and set youtubeVideoId
// This will run AFTER the controller has already validated the URL
videoSchema.pre("save", function (next) {
  if (this.isModified("youtubeLink")) {
    const videoId = extractYouTubeId(this.youtubeLink);
    if (videoId) {
      this.youtubeVideoId = videoId;
    } else {
      // Although controller validates, this is a fallback
      const err = new Error("Invalid YouTube URL format in model.");
      next(err);
    }
  }
  next();
});

// Add indexes for better performance
videoSchema.index({ topic: 1, createdAt: -1 });

const Video = mongoose.model("Video", videoSchema);
module.exports = Video;
