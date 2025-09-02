// controllers/admin/videoController.js

const asyncHandler = require("express-async-handler");
const Video = require("../../models/videoModel");

/**
 * @desc    Add a new YouTube link with a title and topic
 * @route   POST /api/videos
 * @access  Private/Admin
 */
const addVideoLink = asyncHandler(async (req, res) => {
  // Admin ab title, link, aur topic teeno dega
  const { title, youtubeLink, topic } = req.body;

  if (!title || !youtubeLink || !topic) {
    res.status(400);
    throw new Error("Title, YouTube Link, and Topic are required");
  }

  // Check for duplicate link
  const linkExists = await Video.findOne({ youtubeLink });
  if (linkExists) {
    res.status(400);
    throw new Error("This YouTube link has already been added");
  }

  const video = await Video.create({
    user: req.user._id,
    title: title.trim(),
    youtubeLink: youtubeLink.trim(),
    topic: topic.trim(),
  });

  res.status(201).json(video);
});

/**
 * @desc    Get all videos, optionally filtered by topic
 * @route   GET /api/videos?topic=...
 * @access  Public
 */
const getVideos = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.topic) {
    filter.topic = req.query.topic;
  }
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
  res.json(topics.sort());
});

/**
 * @desc    Delete a video link
 * @route   DELETE /api/videos/:id
 * @access  Private/Admin
 */
const deleteVideo = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id);
  if (video) {
    await video.deleteOne();
    res.json({ message: "Video link removed successfully" });
  } else {
    res.status(404);
    throw new Error("Video not found");
  }
});

module.exports = {
  addVideoLink, // Naam badal diya hai
  getVideos,
  getUniqueTopics,
  deleteVideo,
};
