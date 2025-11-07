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

  combinedNotifications.sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  res.status(200).json(combinedNotifications.slice(0, 15));
});

// --- YEH FUNCTION UPDATE HUA HAI ---
const markAsRead = asyncHandler(async (req, res) => {
  const notificationId = req.params.id;
  const [type, id] = notificationId.split("-");

  if (!type || !id) {
    res.status(400);
    throw new Error("Invalid notification ID format");
  }

  let updatedDocument = null;

  switch (type) {
    case "user":
      // User ka status 'Pending' se 'Active' kar rahe hain
      // Aap isko apne logic ke hisaab se 'Viewed' ya kuch aur bhi kar sakte hain
      updatedDocument = await User.findByIdAndUpdate(
        id,
        { status: "Active" },
        { new: true }
      );
      break;

    case "sellerinquiry":
      // Inquiry ka status 'Pending' se 'Viewed' kar rahe hain
      updatedDocument = await SellerInquiry.findByIdAndUpdate(
        id,
        { status: "Viewed" },
        { new: true }
      );
      break;

    // Aap yahan dusre types (customization, premium, etc.) ke liye bhi cases add kar sakte hain

    default:
      res.status(400);
      throw new Error(`Unknown notification type: ${type}`);
  }

  if (updatedDocument) {
    res
      .status(200)
      .json({ message: "Notification marked as read successfully" });
  } else {
    res.status(404);
    throw new Error(`Document not found for type ${type} with id ${id}`);
  }
});

module.exports = {
  getUnreadCounts,
  getNotifications,
  markAsRead,
};
