const Package = require("../models/packageModel.js");

const createPackage = async (req, res) => {
  try {
    const newPackage = new Package(req.body);
    const savedPackage = await newPackage.save();
    res.status(201).json({
      success: true,
      message: "Package created successfully",
      data: savedPackage,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create package",
      error: error.message,
    });
  }
};

const getPackages = async (req, res) => {
  try {
    const { packageType } = req.query;

    const filter = {};
    if (packageType) {
      filter.packageType = packageType;
    }

    const packages = await Package.find(filter);
    res.status(200).json({
      success: true,
      count: packages.length,
      data: packages,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch packages",
      error: error.message,
    });
  }
};

// एक पैकेज को ID से प्राप्त करने के लिए
const getPackageById = async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg) {
      return res.status(404).json({ success: false, message: "Package not found" });
    }
    res.status(200).json({ success: true, data: pkg });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch package",
      error: error.message,
    });
  }
};

// एक पैकेज को अपडेट करने के लिए
const updatePackage = async (req, res) => {
  try {
    const updatedPackage = await Package.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedPackage) {
      return res.status(404).json({ success: false, message: "Package not found" });
    }
    res.status(200).json({
      success: true,
      message: "Package updated successfully",
      data: updatedPackage,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update package",
      error: error.message,
    });
  }
};

// एक पैकेज को हटाने के लिए
const deletePackage = async (req, res) => {
  try {
    const deletedPackage = await Package.findByIdAndDelete(req.params.id);
    if (!deletedPackage) {
      return res.status(404).json({ success: false, message: "Package not found" });
    }
    res.status(200).json({ success: true, message: "Package deleted successfully" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete package",
      error: error.message,
    });
  }
};

// सभी फंक्शन्स को एक्सपोर्ट करें
module.exports = {
  createPackage,
  getPackages,
  getPackageById,
  updatePackage,
  deletePackage,
};