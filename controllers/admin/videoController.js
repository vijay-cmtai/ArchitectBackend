// controllers/admin/videoController.js
const asyncHandler = require("express-async-handler");
const Video = require("../../models/videoModel");

// Robust function to validate and extract YouTube ID
const validateAndExtractYouTubeId = (url) => {
  if (!url || typeof url !== "string") return null;
  const regExp =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

/**
 * @desc    Add a new YouTube link
 * @route   POST /api/videos
 * @access  Private/Admin
 */
const addVideoLink = asyncHandler(async (req, res) => {
  const { title, youtubeLink, topic } = req.body;

  if (!title || !youtubeLink || !topic) {
    res.status(400);
    throw new Error("Title, YouTube Link, and Topic are required");
  }

  // Validate YouTube URL and get Video ID
  const videoId = validateAndExtractYouTubeId(youtubeLink);
  if (!videoId) {
    res.status(400);
    throw new Error("Invalid YouTube URL format. Please provide a valid link.");
  }

  // Check if a video with this ID already exists
  const videoExists = await Video.findOne({ youtubeVideoId: videoId });
  if (videoExists) {
    res.status(400);
    throw new Error("A video with this YouTube ID already exists.");
  }

  const video = await Video.create({
    user: req.user._id,
    title: title.trim(),
    youtubeLink: youtubeLink.trim(),
    topic: topic.trim(),
    youtubeVideoId: videoId, // We already have the ID
  });

  res.status(201).json(video);
});

/**
 * @desc    Get all videos
 * @route   GET /api/videos
 * @access  Public
 */
const getVideos = asyncHandler(async (req, res) => {
  const filter = req.query.topic ? { topic: req.query.topic } : {};
  const videos = await Video.find(filter).sort({ createdAt: -1 });
  res.json(videos);
});

/**
 * @desc    Get all unique topics
 * @route   GET /api/videos/topics
 * @access  Public
 */
const getUniqueTopics = asyncHandler(async (req, res) => {
  const topics = await Video.distinct("topic");
  res.json(topics.filter(Boolean).sort());
});

/**
 * @desc    Delete a video link
 * @route   DELETE /api/videos/:id
 * @access  Private/Admin
 */
const deleteVideo = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id);

  if (!video) {
    res.status(404);
    throw new Error("Video not found");
  }

  await video.deleteOne();
  res.json({ message: "Video link removed successfully" });
});

module.exports = {
  addVideoLink,
  getVideos,
  getUniqueTopics,
  deleteVideo,
};
