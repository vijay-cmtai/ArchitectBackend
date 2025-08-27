const express = require("express");
const router = express.Router();
const {
  createPremiumRequest,
  getAllPremiumRequests,
  updatePremiumRequest,
  deletePremiumRequest,
} = require("../controllers/premiumRequestController.js");

const { protect, admin } = require("../middleware/authMiddleware.js");

router.route("/").post(createPremiumRequest);

router.route("/").get(protect, admin, getAllPremiumRequests);

router
  .route("/:id")
  .put(protect, admin, updatePremiumRequest)
  .delete(protect, admin, deletePremiumRequest);

module.exports = router;
