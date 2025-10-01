const asyncHandler = require("express-async-handler");
const Order = require("../models/orderModel.js");

/**
 * @desc    Get orders containing products of the logged-in professional
 * @route   GET /api/professional-orders/my-orders
 * @access  Private/Professional
 */
const getMyProfessionalOrders = asyncHandler(async (req, res) => {
  // Find all orders where at least one order item was created by this professional.
  const orders = await Order.find({ "orderItems.professional": req.user._id })
    .populate("user", "name email") // To show customer's name and email
    .sort({ createdAt: -1 });

  if (orders) {
    // For each order, filter out items that do not belong to this professional.
    const professionalSpecificOrders = orders.map((order) => {
      const professionalItems = order.orderItems.filter(
        (item) =>
          item.professional &&
          item.professional.toString() === req.user._id.toString()
      );

      // Return a new order object with only the relevant items for the professional.
      return {
        ...order.toObject(), // Convert mongoose document to a plain object
        orderItems: professionalItems,
      };
    });

    res.json(professionalSpecificOrders);
  } else {
    // If no orders are found, return an empty array.
    res.json([]);
  }
});

module.exports = {
  getMyProfessionalOrders,
};
