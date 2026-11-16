const mongoose = require("mongoose");

const chunkSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    chunkIndex: {
      type: Number,
      required: true,
    },

    pageNumber: {
      type: Number,
      default: 0,
    },

    text: {
      type: String,
      required: true,
    },

    characterCount: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Chunk", chunkSchema);