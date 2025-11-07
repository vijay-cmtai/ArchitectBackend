const asyncHandler = require("express-async-handler");
const User = require("../models/userModel");
const SellerInquiry = require("../models/sellerinquiryModel");
const CustomizationRequest = require("../models/customizationRequestModel");
const PremiumRequest = require("../models/premiumRequestModel");
const CorporateInquiry = require("../models/corporateInquiryModel");
const Inquiry = require("../models/inquiryModel");

const getUnreadCounts = asyncHandler(async (req, res) => {
  const newUsers = await User.countDocuments({ status: "Pending" });
  const sellerEnquiries = await SellerInquiry.countDocuments({
    status: "Pending",
  });
  const customization = await CustomizationRequest.countDocuments({
    status: "Pending",
  });
  const premium = await PremiumRequest.countDocuments({ status: "Pending" });
  const corporate = await CorporateInquiry.countDocuments({ status: "New" });
  const sellerContractor = await Inquiry.countDocuments({ status: "New" });

  res.json({
    newUsers,
    orders: 0,
    sellerEnquiries,
    requests: {
      customization,
      premium,
      total: customization + premium,
    },
    inquiries: {
      corporate,
      sellerContractor,
      total: corporate + sellerContractor,
    },
  });
});

const getNotifications = asyncHandler(async (req, res) => {
  let combinedNotifications = [];

  const newUsers = await User.find({ status: "Pending" })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();
  newUsers.forEach((item) => {
    combinedNotifications.push({
      _id: `user-${item._id.toString()}`,
      message: `New user signed up: ${item.name}`,
      link: `/admin/customers`,
      createdAt: item.createdAt,
    });
  });

  const sellerEnquiries = await SellerInquiry.find({ status: "Pending" })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();
  sellerEnquiries.forEach((item) => {
    combinedNotifications.push({
      _id: `sellerinquiry-${item._id.toString()}`,
      message: `New seller inquiry from ${item.name}`,
      link: "/admin/seller-enquiries",
      createdAt: item.createdAt,
    });
  });

  // Aap yahan baaki models (Customization, Premium, etc.) ke liye bhi code add kar sakte hain.

  combinedNotifications.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  res.status(200).json(combinedNotifications.slice(0, 15));
});

const markAsRead = asyncHandler(async (req, res) => {
  // Is "quick-fix" approach mein database mein kuch update nahi hoga,
  // kyunki notification record hai hi nahi.
  // Frontend se item hatane ke liye
  // sirf ek success response bhej rahe hain.
  res.status(200).json({ message: "Notification acknowledged" });
});

module.exports = {
  getUnreadCounts,
  getNotifications,
  markAsRead,
};
