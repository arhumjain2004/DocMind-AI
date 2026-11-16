const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },

  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);

    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const extension = path
    .extname(file.originalname)
    .toLowerCase();

  const isPdf =
    file.mimetype === "application/pdf" &&
    extension === ".pdf";

  if (isPdf) {
    cb(null, true);
  } else {
    const error = new Error("Only PDF files are allowed");
    error.code = "INVALID_FILE_TYPE";
    cb(error);
  }
};

const upload = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

module.exports = upload;
