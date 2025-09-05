const multer = require("multer");
const s3Storage = require("../config/s3Config");

const upload = multer({
  storage: s3Storage,
  limits: {
    fileSize: 1024 * 1024 * 5,
  },
});

module.exports = upload;
