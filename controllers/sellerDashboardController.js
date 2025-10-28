const asyncHandler = require("express-async-handler");
const SellerInquiry = require("../models/sellerinquiryModel.js");
const SellerProduct = require("../models/sellerProductModel.js");

const getSellerDashboardData = asyncHandler(async (req, res) => {
  const sellerId = req.user._id;

  const totalProductsPromise = SellerProduct.countDocuments({
    seller: sellerId,
  });

  const totalInquiriesPromise = SellerInquiry.countDocuments({
    seller: sellerId,
  });

  const uniqueBuyersPromise = SellerInquiry.distinct("email", {
    seller: sellerId,
  });

  const recentInquiriesPromise = SellerInquiry.find({ seller: sellerId })
    .populate("product", "name")
    .sort({ createdAt: -1 })
    .limit(5);

  const [totalProducts, totalInquiries, uniqueBuyers, recentInquiries] =
    await Promise.all([
      totalProductsPromise,
      totalInquiriesPromise,
      uniqueBuyersPromise,
      recentInquiriesPromise,
    ]);

  res.json({
    totalProducts,
    totalInquiries,
    totalBuyers: uniqueBuyers.length,
    recentInquiries,
  });
});

module.exports = {
  getSellerDashboardData,
};
