const express = require("express");

const protect = require("../middleware/authMiddleware");

const upload = require("../middleware/uploadMiddleware");

const {
  uploadDocument,
  getDocuments,
    getDocumentChunks,
      testEmbedding,
        testQdrant,
         indexDocumentChunks,
          searchDocuments,
          generateRagContext,
           askDocument,
           summarizeDocument,
            generateDocumentQuiz,
              generateDocumentFlashcards,
                deleteDocument


} = require("../controllers/documentController");

const router = express.Router();

router.post(
  "/upload",
  protect,
  upload.single("document"),
  uploadDocument
);
router.get(
  "/:documentId/chunks",
  protect,
  getDocumentChunks
);

router.get(
  "/test-embedding",
  protect,
  testEmbedding
);
router.get(
  "/test-qdrant",
  protect,
  testQdrant
);
router.post(
  "/:documentId/index",
  protect,
  indexDocumentChunks
);
router.post(
  "/search",
  protect,
  searchDocuments
);

router.post(
  "/rag-context",
  protect,
  generateRagContext
);
router.post(
  "/ask",
  protect,
  askDocument
);
router.get(
  "/",
  protect,
  getDocuments
);
router.post(
  "/summarize",
  protect,
  summarizeDocument
);
router.post(
  "/quiz",
  protect,
  generateDocumentQuiz
);
router.post(
  "/flashcards",
    protect,
  generateDocumentFlashcards
);
router.delete("/:documentId", protect, deleteDocument);
module.exports = router;