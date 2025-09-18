// models/videoModel.js
const mongoose = require("mongoose");

// Helper function to extract YouTube video ID from URL
const extractYouTubeId = (url) => {
  if (!url) return null;

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
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
      validate: {
        validator: function (url) {
          return extractYouTubeId(url) !== null;
        },
        message: "Please provide a valid YouTube URL",
      },
    },
    // Add youtubeVideoId field that will be auto-generated
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
videoSchema.pre("save", function (next) {
  if (this.youtubeLink && this.isModified("youtubeLink")) {
    this.youtubeVideoId = extractYouTubeId(this.youtubeLink);
  }
  next();
});

// Add indexes for better performance
videoSchema.index({ topic: 1, createdAt: -1 });
videoSchema.index({ youtubeVideoId: 1 }, { unique: true, sparse: true });

const Video = mongoose.model("Video", videoSchema);
module.exports = Video;
