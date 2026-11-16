
const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const documentRoutes = require("./routes/documentRoutes");

const connectDB = require("./config/db");

const {
  createCollection,
} = require("./services/qdrantCollectionService");

const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/documents", documentRoutes);

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "DocMind AI server is running",
  });
});

// Normalize errors raised by upload middleware and uncaught route failures.
app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const safeErrorCodes = new Set([
    "LIMIT_FILE_SIZE",
    "INVALID_FILE_TYPE",
    "LIMIT_UNEXPECTED_FILE",
  ]);
  const safeCode = safeErrorCodes.has(error?.code)
    ? error.code
    : "UNEXPECTED_ERROR";

  console.error("API request failed", { code: safeCode });

  if (error?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      success: false,
      message: "File exceeds the 10 MiB upload limit.",
    });
  }

  if (error?.code === "INVALID_FILE_TYPE") {
    return res.status(400).json({
      success: false,
      message: "Only PDF files are allowed.",
    });
  }

  if (error?.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({
      success: false,
      message: "Unexpected upload field.",
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
});

// Server Port
const PORT = process.env.PORT || 5000;

// Start Server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Initialize Qdrant collection and payload indexes
    await createCollection();

    // Start Express server
    app.listen(PORT, () => {
      console.log(
        `DocMind AI server running on port ${PORT}`
      );
    });
  } catch (error) {
    console.error(
      "Server startup error:",
      error
    );

    process.exit(1);
  }
};

startServer();
