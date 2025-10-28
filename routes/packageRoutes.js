const express = require("express");
const {
  createPackage,
  getPackages,
  getPackageById,
  updatePackage,
  deletePackage,
} = require("../controllers/packageController.js");

const router = express.Router();

router.route("/").post(createPackage).get(getPackages);

router
  .route("/:id")
  .get(getPackageById)
  .put(updatePackage)
  .delete(deletePackage);

module.exports = router;
