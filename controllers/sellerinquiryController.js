const asyncHandler = require("express-async-handler");
const SellerInquiry = require("../models/sellerinquiryModel.js");
const SellerProduct = require("../models/sellerProductModel.js");
const createInquiry = asyncHandler(async (req, res) => {
  const { productId, name, email, phone, message } = req.body;

  const product = await SellerProduct.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  const inquiry = new SellerInquiry({
    product: productId,
    seller: product.seller,
    user: req.user ? req.user._id : null,
    name,
    email,
    phone,
    message,
  });

  const createdInquiry = await inquiry.save();
  res.status(201).json(createdInquiry);
});
const getMyInquiries = asyncHandler(async (req, res) => {
  const inquiries = await SellerInquiry.find({ seller: req.user._id })
    .populate("product", "name image")
    .sort({ createdAt: -1 });

  res.json(inquiries);
});
const getAllInquiries = asyncHandler(async (req, res) => {
  const inquiries = await SellerInquiry.find({})
    .populate("product", "name")
    .populate("seller", "businessName")
    .sort({ createdAt: -1 });
  res.json(inquiries);
});

const getInquiryById = asyncHandler(async (req, res) => {
  const inquiry = await SellerInquiry.findById(req.params.id)
    .populate("product")
    .populate("seller", "businessName email phone")
    .populate("user", "name email");

  if (!inquiry) {
    res.status(404);
    throw new Error("Inquiry not found");
  }

  if (
    req.user.role !== "admin" &&
    inquiry.seller._id.toString() !== req.user._id.toString()
  ) {
    res.status(401);
    throw new Error("Not authorized to view this inquiry");
  }

  res.json(inquiry);
});
const updateInquiryStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  const inquiry = await SellerInquiry.findById(req.params.id);

  if (!inquiry) {
    res.status(404);
    throw new Error("Inquiry not found");
  }

  if (
    inquiry.seller.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    res.status(401);
    throw new Error("Not authorized to update this inquiry");
  }

  inquiry.status = status || inquiry.status;

  const updatedInquiry = await inquiry.save();
  res.json(updatedInquiry);
});

module.exports = {
  createInquiry,
  getMyInquiries,
  getAllInquiries,
  getInquiryById,
  updateInquiryStatus,
};
