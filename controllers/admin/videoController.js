// controllers/admin/videoController.js
const asyncHandler = require("express-async-handler");
const Video = require("../../models/videoModel");

// Enhanced YouTube URL validation function
const validateAndExtractYouTubeId = (url) => {
  if (!url || typeof url !== "string") {
    console.log("Invalid URL input:", url);
    return { isValid: false, videoId: null, error: "URL is required" };
  }

  const trimmedUrl = url.trim();
  console.log("Processing URL:", trimmedUrl);

  // Multiple patterns to handle different YouTube URL formats
  const patterns = [
    // Standard youtube.com/watch?v=
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    // Short youtu.be format
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
    // Embed format
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    // Mobile format
    /(?:https?:\/\/)?(?:www\.)?m\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    // Any youtube URL with v parameter
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/,
  ];

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const match = trimmedUrl.match(pattern);
    console.log(`Pattern ${i + 1} match:`, match ? match[1] : "no match");

    if (match && match[1]) {
      const videoId = match[1];
      // Validate that the video ID is exactly 11 characters and contains valid characters
      if (videoId.length === 11 && /^[a-zA-Z0-9_-]+$/.test(videoId)) {
        console.log("Valid video ID found:", videoId);
        return { isValid: true, videoId: videoId, error: null };
      }
    }
  }

  console.log("No valid YouTube ID found in URL:", trimmedUrl);
  return { isValid: false, videoId: null, error: "Invalid YouTube URL format" };
};

/**
 * @desc    Add a new YouTube link with a title and topic
 * @route   POST /api/videos
 * @access  Private/Admin
 */
const addVideoLink = asyncHandler(async (req, res) => {
  console.log("=== ADD VIDEO LINK REQUEST ===");
  console.log("Request body:", req.body);
  console.log("User:", req.user ? req.user._id : "No user");

  const { title, youtubeLink, topic } = req.body;

  // Validate required fields
  if (!title || !youtubeLink || !topic) {
    console.log("Missing required fields:", {
      title: !!title,
      youtubeLink: !!youtubeLink,
      topic: !!topic,
    });
    res.status(400);
    throw new Error("Title, YouTube Link, and Topic are required");
  }

  // Validate YouTube URL
  const validation = validateAndExtractYouTubeId(youtubeLink);
  console.log("URL validation result:", validation);

  if (!validation.isValid) {
    res.status(400);
    throw new Error(`Please provide a valid YouTube URL. ${validation.error}`);
  }

  try {
    // Check for duplicate link
    console.log("Checking for duplicate link...");
    const linkExists = await Video.findOne({ youtubeLink: youtubeLink.trim() });
    if (linkExists) {
      console.log("Duplicate link found:", linkExists._id);
      res.status(400);
      throw new Error("This YouTube link has already been added");
    }

    // Check for duplicate video ID
    const videoIdExists = await Video.findOne({
      youtubeVideoId: validation.videoId,
    });
    if (videoIdExists) {
      console.log("Duplicate video ID found:", videoIdExists._id);
      res.status(400);
      throw new Error("A video with this YouTube ID already exists");
    }

    console.log("Creating new video...");
    const video = await Video.create({
      user: req.user._id,
      title: title.trim(),
      youtubeLink: youtubeLink.trim(),
      topic: topic.trim(),
    });

    console.log("Video created successfully:", video._id);

    res.status(201).json({
      _id: video._id,
      title: video.title,
      youtubeLink: video.youtubeLink,
      youtubeVideoId: video.youtubeVideoId,
      topic: video.topic,
      createdAt: video.createdAt,
    });
  } catch (error) {
    console.error("Error in addVideoLink:", error);

    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      if (error.keyPattern?.youtubeVideoId) {
        res.status(400);
        throw new Error("A video with this YouTube ID already exists");
      }
      if (error.keyPattern?.youtubeLink) {
        res.status(400);
        throw new Error("This YouTube link has already been added");
      }
    }
    throw error;
  }
});

/**
 * @desc    Get all videos, optionally filtered by topic
 * @route   GET /api/videos?topic=...
 * @access  Public
 */
const getVideos = asyncHandler(async (req, res) => {
  console.log("=== GET VIDEOS REQUEST ===");
  console.log("Query params:", req.query);

  const filter = {};
  if (req.query.topic) {
    filter.topic = req.query.topic;
  }

  const videos = await Video.find(filter)
    .sort({ createdAt: -1 })
    .select("title youtubeLink youtubeVideoId topic createdAt updatedAt");

  console.log(`Found ${videos.length} videos`);
  res.json(videos);
});

/**
 * @desc    Get all unique topics
 * @route   GET /api/videos/topics
 * @access  Public
 */
const getUniqueTopics = asyncHandler(async (req, res) => {
  console.log("=== GET TOPICS REQUEST ===");

  const topics = await Video.distinct("topic");
  const filteredTopics = topics.filter((topic) => topic).sort();

  console.log(`Found ${filteredTopics.length} topics:`, filteredTopics);
  res.json(filteredTopics);
});

/**
 * @desc    Delete a video link
 * @route   DELETE /api/videos/:id
 * @access  Private/Admin
 */
const deleteVideo = asyncHandler(async (req, res) => {
  console.log("=== DELETE VIDEO REQUEST ===");
  console.log("Video ID:", req.params.id);
  console.log("User:", req.user ? req.user._id : "No user");

  const video = await Video.findById(req.params.id);

  if (!video) {
    console.log("Video not found");
    res.status(404);
    throw new Error("Video not found");
  }

  // Check authorization
  if (
    video.user.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    console.log("Unauthorized delete attempt");
    res.status(401);
    throw new Error("Not authorized to delete this video");
  }

  await video.deleteOne();
  console.log("Video deleted successfully");

  res.json({
    message: "Video link removed successfully",
    deletedVideo: {
      _id: video._id,
      title: video.title,
      topic: video.topic,
    },
  });
});

/**
 * @desc    Get a single video by ID
 * @route   GET /api/videos/:id
 * @access  Public
 */
const getVideoById = asyncHandler(async (req, res) => {
  console.log("=== GET VIDEO BY ID REQUEST ===");
  console.log("Video ID:", req.params.id);

  const video = await Video.findById(req.params.id).select(
    "title youtubeLink youtubeVideoId topic createdAt updatedAt"
  );

  if (video) {
    console.log("Video found:", video._id);
    res.json(video);
  } else {
    console.log("Video not found");
    res.status(404);
    throw new Error("Video not found");
  }
});

module.exports = {
  addVideoLink,
  getVideos,
  getUniqueTopics,
  deleteVideo,
  getVideoById,
};
