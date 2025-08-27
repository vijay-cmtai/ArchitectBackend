// controllers/adminController.js

const asyncHandler = require("express-async-handler");
const Order = require("../models/orderModel");
const User = require("../models/userModel");
const Product = require("../models/productModel");
const ProfessionalPlan = require("../models/professionalPlanModel");
const CustomizationRequest = require("../models/customizationRequestModel");
const StandardRequest = require("../models/standardRequestModel");
const PremiumRequest = require("../models/premiumRequestModel");
const CorporateInquiry = require("../models/corporateInquiryModel");
const Inquiry = require("../models/inquiryModel");

// --- Dashboard ---
const getDashboardSummary = asyncHandler(async (req, res) => {
  const totalOrders = await Order.countDocuments({});
  const totalRevenueResult = await Order.aggregate([
    { $match: { isPaid: true } },
    { $group: { _id: null, totalRevenue: { $sum: "$totalPrice" } } },
  ]);
  const totalRevenue =
    totalRevenueResult.length > 0 ? totalRevenueResult[0].totalRevenue : 0;

  const totalCustomers = await User.countDocuments({ role: "user" });
  const totalProducts = await Product.countDocuments({});
  const totalProfessionalPlans = await ProfessionalPlan.countDocuments({
    status: { $in: ["Approved", "Published"] },
  });

  const recentOrders = await Order.find({})
    .populate("user", "name")
    .sort({ createdAt: -1 })
    .limit(5);

  res.json({
    totalOrders,
    totalRevenue,
    totalCustomers,
    totalProducts: totalProducts + totalProfessionalPlans,
    recentOrders,
  });
});

// --- User Management ---
const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}).select("-password");
  res.json(users);
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (user) {
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.role = req.body.role || user.role;
    user.isApproved = req.body.isApproved;
    user.status = req.body.status || user.status;
    const updatedUser = await user.save();
    res.json(updatedUser);
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (user) {
    if (user.role === "admin") {
      res.status(400);
      throw new Error("Cannot delete admin user");
    }
    await user.deleteOne();
    res.json({ message: "User removed" });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

// --- Order Management ---
const getAllOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({})
    .populate("user", "id name email")
    .sort({ createdAt: -1 });
  res.json(orders);
});

const updateOrderToPaid = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (order) {
    order.isPaid = true;
    order.paidAt = Date.now();
    const updatedOrder = await order.save();
    res.json(updatedOrder);
  } else {
    res.status(404);
    throw new Error("Order not found");
  }
});

const deleteOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (order) {
    await order.deleteOne();
    res.json({ message: "Order removed" });
  } else {
    res.status(404);
    throw new Error("Order not found");
  }
});

// --- Product & Plan Management ---
const getAllAdminProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({}).populate("user", "name");
  res.json(products);
});

const getAllProfessionalPlans = asyncHandler(async (req, res) => {
  const plans = await ProfessionalPlan.find({}).populate(
    "professional",
    "name"
  );
  res.json(plans);
});

const updateProfessionalPlanStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const plan = await ProfessionalPlan.findById(req.params.id);
  if (plan) {
    plan.status = status;
    const updatedPlan = await plan.save();
    res.json(updatedPlan);
  } else {
    res.status(404);
    throw new Error("Plan not found");
  }
});

const deleteProfessionalPlan = asyncHandler(async (req, res) => {
  const plan = await ProfessionalPlan.findById(req.params.id);
  if (plan) {
    await plan.deleteOne();
    res.json({ message: "Plan removed" });
  } else {
    res.status(404);
    throw new Error("Plan not found");
  }
});

// --- Requests & Inquiries ---
const getAllRequestsAndInquiries = asyncHandler(async (req, res) => {
  const customization = await CustomizationRequest.find({}).sort({
    createdAt: -1,
  });
  const standard = await StandardRequest.find({}).sort({ createdAt: -1 });
  const premium = await PremiumRequest.find({}).sort({ createdAt: -1 });
  const corporate = await CorporateInquiry.find({}).sort({ createdAt: -1 });
  const generalInquiries = await Inquiry.find({}).sort({ createdAt: -1 });
  res.json({ customization, standard, premium, corporate, generalInquiries });
});

// --- ✨ NEW FUNCTION FOR REPORTS PAGE ✨ ---
const getReportsData = asyncHandler(async (req, res) => {
  const totalSalesResult = await Order.aggregate([
    { $match: { isPaid: true } },
    { $group: { _id: null, total: { $sum: "$totalPrice" } } },
  ]);
  const totalOrders = await Order.countDocuments({});
  const totalCustomers = await User.countDocuments({ role: "user" });
  const thirtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 30));
  const dailySales = await Order.aggregate([
    { $match: { isPaid: true, createdAt: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        totalSales: { $sum: "$totalPrice" },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  const topProducts = await Order.aggregate([
    { $match: { isPaid: true } },
    { $unwind: "$orderItems" },
    {
      $group: {
        _id: "$orderItems.name",
        sales: { $sum: "$orderItems.quantity" },
      },
    },
    { $sort: { sales: -1 } },
    { $limit: 5 },
  ]);

  res.json({
    summary: {
      netSales: totalSalesResult.length > 0 ? totalSalesResult[0].total : 0,
      orders: totalOrders,
      customers: totalCustomers,
      avgOrderValue:
        totalOrders > 0
          ? totalSalesResult.length > 0
            ? totalSalesResult[0].total / totalOrders
            : 0
          : 0,
    },
    salesOverTime: dailySales.map((d) => ({
      date: d._id,
      sales: d.totalSales,
    })),
    topProducts: topProducts.map((p) => ({ name: p._id, sales: p.sales })),
  });
});

module.exports = {
  getDashboardSummary,
  getAllUsers,
  updateUser,
  deleteUser,
  getAllOrders,
  updateOrderToPaid,
  deleteOrder,
  getAllAdminProducts,
  getAllProfessionalPlans,
  updateProfessionalPlanStatus,
  deleteProfessionalPlan,
  getAllRequestsAndInquiries,
  getReportsData, 
};
