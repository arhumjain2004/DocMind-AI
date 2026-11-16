
const fs = require("fs/promises");
const Document = require("../models/Document");
const Chunk = require("../models/Chunk");
const qdrant = require("../services/qdrantService");

const {
  generateAnswer,
  generateDocumentSummary,
  generateQuizContent,
  generateFlashcardContent,
  generateRagAnswer,
} = require("../services/llmService");

const {
  buildContext,
  buildContextWithSources,
} = require("../services/ragService");

const {
  extractDeterministicList,
} = require("../services/deterministicListExtractionService");

const {
  searchSimilarChunks,
} = require("../services/searchService");

const {
  upsertChunks,
} = require("../services/vectorService");

const {
  createCollection,
  COLLECTION_NAME,
} = require("../services/qdrantCollectionService");

const {
  generateEmbedding,
} = require("../services/embeddingService");

const {
  cleanText,
} = require("../utils/textUtils");

const {
  createPageChunks,
} = require("../services/chunkService");

const {
  extractPdfText,
} = require("../services/documentService");

// These guards prevent overlapping upload/delete workflows in this process.
const activeUploads = new Set();
const activeDeletions = new Set();

const logUploadCleanupFailure = (stage, error) => {
  console.error(`[UPLOAD_CLEANUP] ${stage} failed`, {
    code: error?.code || "UNKNOWN",
  });
};

const removeUploadedPdf = async (filePath, stage = "pdf_remove") => {
  if (!filePath) return true;

  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return true;
    logUploadCleanupFailure(stage, error);
    return false;
  }
};


// ==========================================
// 1. UPLOAD AND PROCESS PDF DOCUMENT
// ==========================================

const uploadDocument = async (req, res) => {
  let document;
  const uploadedFilePath = req.file?.path;

  try {
    // 1. Check whether a file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a PDF file",
      });
    }

    const {
      originalname,
      filename,
      path: filePath,
      mimetype,
      size,
    } = req.file;

    // 2. Validate the uploaded file
    if (mimetype !== "application/pdf") {
      await removeUploadedPdf(uploadedFilePath, "pdf_rejected");
      return res.status(400).json({
        success: false,
        message: "Only PDF files are allowed",
      });
    }

    // 3. Save document metadata in MongoDB
    document = await Document.create({
      userId: req.userId,
      title: originalname.replace(/\.pdf$/i, ""),
      originalName: originalname,
      fileName: filename,
      filePath,
      fileType: mimetype,
      fileSize: size,
      status: "processing",
    });
    activeUploads.add(String(document._id));

    try {
      // 4. Extract text from the PDF
      const { text, pageCount, pages } = await extractPdfText(filePath);

      if (!text || !text.trim()) {
        throw new Error("No readable text found in the PDF");
      }

      // 5. Clean extracted text
      const cleanedText = cleanText(text);

      if (!cleanedText) {
        throw new Error("PDF text is empty after cleaning");
      }

      if (!Array.isArray(pages) || pages.length === 0) {
        throw new Error("PDF page-level text was not returned");
      }

      // 6. Split each page into chunks so page citations stay accurate.
      const chunks = createPageChunks(
        pages.map((page) => ({
          pageNumber: page.pageNumber,
          text: cleanText(page.text),
        }))
      );

      if (!chunks || chunks.length === 0) {
        throw new Error("No text chunks could be created");
      }

      // 7. Prepare chunks for MongoDB
      const chunkDocuments = chunks.map((chunk) => ({
        documentId: document._id,
        userId: req.userId,
        chunkIndex: chunk.chunkIndex,
        pageNumber: chunk.pageNumber,
        text: chunk.text,
        characterCount: chunk.characterCount,
      }));

      // 8. Insert chunks into MongoDB
      const insertedChunks = await Chunk.insertMany(chunkDocuments);

      if (insertedChunks.length !== chunkDocuments.length) {
        throw new Error("Not all document chunks were saved");
      }

      // Index every saved chunk before marking the document ready.
      await upsertChunks(insertedChunks);

      // 9. Update document status and extracted content only after indexing.
      const readyResult = await Document.updateOne(
        {
          _id: document._id,
          userId: req.userId,
          status: "processing",
        },
        {
          $set: {
            extractedText: cleanedText,
            pageCount: pageCount || 1,
            status: "ready",
          },
        }
      );

      if (readyResult.matchedCount !== 1) {
        throw new Error("Document is no longer processing");
      }

      document.extractedText = cleanedText;
      document.pageCount = pageCount || 1;
      document.status = "ready";

      // 10. Send successful response
      return res.status(201).json({
        success: true,
        message: "Document uploaded and processed successfully",
        document: {
          id: document._id,
          title: document.title,
          originalName: document.originalName,
          pageCount: document.pageCount,
          chunksCreated: chunks.length,
          status: document.status,
          createdAt: document.createdAt,
        },
      });
    } catch (processingError) {
      // Log the actual PDF processing error in the backend terminal
      console.error("PDF processing error:", processingError);

      // Preserve the failed upload record even if status persistence fails.
      try {
        const failedResult = await Document.updateOne(
          {
            _id: document._id,
            userId: req.userId,
            status: "processing",
          },
          { $set: { status: "failed" } }
        );

        if (failedResult.matchedCount === 1) {
          document.status = "failed";
        }
      } catch (saveError) {
        logUploadCleanupFailure("status_failed", saveError);
      }

      // Remove only vectors owned by this upload. If this fails, retain the
      // MongoDB chunks and PDF so the failed document can be recovered.
      try {
        await qdrant.delete(COLLECTION_NAME, {
          filter: {
            must: [
              {
                key: "documentId",
                match: { value: String(document._id) },
              },
              {
                key: "userId",
                match: { value: String(req.userId) },
              },
            ],
          },
          wait: true,
        });
      } catch (cleanupError) {
        logUploadCleanupFailure("qdrant_delete", cleanupError);
        return res.status(500).json({
          success: false,
          message: "Failed to process PDF",
          error:
            process.env.NODE_ENV === "development"
              ? processingError.message
              : undefined,
        });
      }

      // Delete chunks only after Qdrant cleanup succeeds. If MongoDB cleanup
      // fails, leave the PDF in place for recovery.
      try {
        await Chunk.deleteMany({
          documentId: document._id,
          userId: req.userId,
        });
      } catch (cleanupError) {
        logUploadCleanupFailure("chunks_delete", cleanupError);
        return res.status(500).json({
          success: false,
          message: "Failed to process PDF",
          error:
            process.env.NODE_ENV === "development"
              ? processingError.message
              : undefined,
        });
      }

      await removeUploadedPdf(uploadedFilePath);

      return res.status(500).json({
        success: false,
        message: "Failed to process PDF",
        error:
          process.env.NODE_ENV === "development"
            ? processingError.message
            : undefined,
      });
    } finally {
      if (document) activeUploads.delete(String(document._id));
    }
  } catch (error) {
    console.error("Upload document error:", error);

    // If document creation failed, no database record exists to anchor a
    // later cleanup retry, so remove the just-uploaded file here.
    if (!document && uploadedFilePath) {
      await removeUploadedPdf(uploadedFilePath, "pdf_after_document_create_failure");
    }

    return res.status(500).json({
      success: false,
      message: "Server error while uploading document",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};

// ==========================================
// 2. GET ALL USER DOCUMENTS
// ==========================================

const getDocuments = async (req, res) => {
  try {
    const documents = await Document.find({
      userId: req.userId,
    })
      .select(
        "_id title originalName fileType fileSize pageCount status createdAt"
      )
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: documents.length,
      documents,
    });
  } catch (error) {
    console.error(
      "Get documents error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch documents",
    });
  }
};


// ==========================================
// 3. GET CHUNKS OF A DOCUMENT
// ==========================================

const getDocumentChunks = async (req, res) => {
  try {
    const { documentId } = req.params;

    // Verify document ownership
    const document = await Document.findOne({
      _id: documentId,
      userId: req.userId,
      status: { $ne: "deleting" },
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    const chunks = await Chunk.find({
      documentId,
      userId: req.userId,
    }).sort({
      chunkIndex: 1,
    });

    return res.status(200).json({
      success: true,
      count: chunks.length,
      chunks,
    });
  } catch (error) {
    console.error(
      "Get document chunks error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error while fetching chunks",
    });
  }
};


// ==========================================
// 4. TEST LOCAL EMBEDDING MODEL
// ==========================================

const testEmbedding = async (req, res) => {
  try {
    const text =
      "Alex knows JavaScript, React, Node.js and MongoDB.";

    const embedding = await generateEmbedding(text);

    return res.status(200).json({
      success: true,
      text,
      dimensions: embedding.length,
      firstFiveValues: embedding.slice(0, 5),
    });
  } catch (error) {
    console.error(
      "Embedding test error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to generate embedding",
    });
  }
};


// ==========================================
// 5. TEST QDRANT CONNECTION
// ==========================================

const testQdrant = async (req, res) => {
  try {
    await createCollection();

    return res.status(200).json({
      success: true,
      message: "Qdrant connection successful",
      collection: COLLECTION_NAME,
    });
  } catch (error) {
    console.error(
      "Qdrant test error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Qdrant connection failed",
    });
  }
};


// ==========================================
// 6. INDEX DOCUMENT CHUNKS IN QDRANT
// ==========================================

const indexDocumentChunks = async (req, res) => {
  try {
    const { documentId } = req.params;

    // Verify document ownership and readiness
    const document = await Document.findOne({
      _id: documentId,
      userId: req.userId,
      status: "ready",
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found or not ready",
      });
    }

    // Fetch document chunks
    const chunks = await Chunk.find({
      documentId,
      userId: req.userId,
    }).sort({
      chunkIndex: 1,
    });

    if (chunks.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No chunks found for this document",
      });
    }

    // Generate embeddings and store vectors in Qdrant
    await upsertChunks(chunks);

    return res.status(200).json({
      success: true,
      message: "Document chunks indexed successfully",
      documentId,
      chunksIndexed: chunks.length,
    });
  } catch (error) {
    console.error(
      "Index document chunks error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to index document chunks",
    });
  }
};


// ==========================================
// 7. SEARCH WITHIN A SELECTED DOCUMENT
// ==========================================

const searchDocuments = async (req, res) => {
  try {
    const {
      query,
      documentId,
    } = req.body;

    if (
      typeof query !== "string" ||
      !query.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: "Please select a document",
      });
    }

    // Verify document ownership and readiness
    const document = await Document.findOne({
      _id: documentId,
      userId: req.userId,
      status: "ready",
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found or not ready",
      });
    }

    // Search only within the selected document
    const results = await searchSimilarChunks(
      query.trim(),
      req.userId,
      documentId,
      3
    );

    return res.status(200).json({
      success: true,
      query,
      document: {
        id: document._id,
        title: document.title,
      },
      results,
    });
  } catch (error) {
    console.error(
      "Document search error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to search documents",
    });
  }
};


// ==========================================
// 8. GENERATE RAG CONTEXT
// ==========================================

const generateRagContext = async (req, res) => {
  try {
    const {
      query,
      documentId,
    } = req.body;

    if (
      typeof query !== "string" ||
      !query.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Query is required",
      });
    }

    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: "Please select a document",
      });
    }

    // Verify document ownership and readiness
    const document = await Document.findOne({
      _id: documentId,
      userId: req.userId,
      status: "ready",
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found or not ready",
      });
    }

    // Retrieve relevant chunks from the selected document
    const results = await searchSimilarChunks(
      query.trim(),
      req.userId,
      documentId,
      3
    );

    // Build context from retrieved chunks
    const context = buildContext(results);

    return res.status(200).json({
      success: true,
      query,
      document: {
        id: document._id,
        title: document.title,
      },
      sources: results.map((result) => ({
        score: result.score,
        documentId: result.payload.documentId,
        chunkId: result.payload.chunkId,
        chunkIndex: result.payload.chunkIndex,
        pageNumber: result.payload.pageNumber,
        snippet: result.payload.text,
      })),
      context,
    });
  } catch (error) {
    console.error(
      "RAG context generation error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to build RAG context",
    });
  }
};


// ==========================================
// 9. ASK AI ABOUT A SELECTED DOCUMENT
// ==========================================

const askDocument = async (req, res) => {
  try {
    const {
      query,
      documentId,
    } = req.body;

    if (
      typeof query !== "string" ||
      !query.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Query is required",
      });
    }

    if (query.trim().length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Query must be 2000 characters or fewer",
      });
    }

    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: "Please select a document",
      });
    }

    // Verify document belongs to this user
    // and has finished processing
    const document = await Document.findOne({
      _id: documentId,
      userId: req.userId,
      status: "ready",
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found or not ready",
      });
    }

    // Retrieve relevant chunks from this document only
    const results = await searchSimilarChunks(
      query.trim(),
      req.userId,
      documentId,
      3
    );

    if (!results || results.length === 0) {
      return res.status(200).json({
        success: true,
        query,
        document: {
          id: document._id,
          title: document.title,
        },
        answer:
          "I couldn't find relevant information in this document.",
        sources: [],
      });
    }

    // Construct context and retain only sources actually included in it
    const contextBundle = buildContextWithSources(results);
    const context = contextBundle.context;

    const deterministicList = extractDeterministicList(
      query.trim(),
      contextBundle.sources
    );

    if (deterministicList.handled) {
      return res.status(200).json({
        success: true,
        query,
        document: {
          id: document._id,
          title: document.title,
        },
        answer: deterministicList.answer,
        sources: contextBundle.sources.map(({ result }) => ({
          score: result.score,
          documentId: result.payload.documentId,
          chunkId: result.payload.chunkId,
          chunkIndex: result.payload.chunkIndex,
          pageNumber: result.payload.pageNumber,
          snippet: result.payload.text,
        })),
      });
    }

    // Generate a structured, citation-validated RAG answer
    const ragAnswer = await generateRagAnswer(
      query.trim(),
      context,
      contextBundle.sources.map((source) => source.label)
    );

    // Return answer and source citations
    return res.status(200).json({
      success: true,
      query,
      document: {
        id: document._id,
        title: document.title,
      },
      answer: ragAnswer.answer,
      sources: contextBundle.sources.map(({ result }) => ({
        score: result.score,
        documentId: result.payload.documentId,
        chunkId: result.payload.chunkId,
        chunkIndex: result.payload.chunkIndex,
        pageNumber: result.payload.pageNumber,
        snippet: result.payload.text,
      })),
    });
  } catch (error) {
    if (error.code === "QUERY_TOO_LONG") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error(
      "Ask document error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to generate answer",
    });
  }
};


const summarizeDocument = async (req, res) => {
  try {
    const { documentId } = req.body;

    // Validate the document ID
    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: "Document ID is required.",
      });
    }

    // Find a ready document belonging to the logged-in user
    const document = await Document.findOne({
      _id: documentId,
      userId: req.userId,
      status: "ready",
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Ready document not found.",
      });
    }

    // Check that extracted text is available
    if (!document.extractedText?.trim()) {
      return res.status(400).json({
        success: false,
        message: "No extracted text found for this document.",
      });
    }

    // Use a summary-specific path so long documents are summarized hierarchically.
    const summary = await generateDocumentSummary(document.extractedText);

    return res.status(200).json({
      success: true,
      message: "Document summarized successfully.",
      document: {
        _id: document._id,
        title: document.title,
      },
      summary,
    });
  } catch (error) {
    console.error("Document summarization error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to summarize document.",
    });
  }
};


const generateDocumentQuiz = async (req, res) => {
  try {
    const { documentId } = req.body;

    // 1. Validate input
    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: "Document ID is required.",
      });
    }

    // 2. Find a ready document belonging to the logged-in user
    const document = await Document.findOne({
      _id: documentId,
      userId: req.userId,
      status: "ready",
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Ready document not found.",
      });
    }

    // 3. Check extracted text
    if (!document.extractedText?.trim()) {
      return res.status(400).json({
        success: false,
        message: "No extracted text found in this document.",
      });
    }

    // 4. Prompt the LLM to generate a structured quiz
    const prompt = `
You are an educational quiz generator.

Generate exactly 5 multiple-choice questions based ONLY
on the provided document.

STRICT RULES:
1. Each question must be directly supported by the document.
2. Each question must have exactly 4 distinct options.
3. Only one option must be correct.
4. The correctAnswerText must exactly match one of the options.
5. The explanation must justify the correct answer using
   information from the document.
6. Do not invent facts or use outside knowledge.
7. Avoid ambiguous or repetitive questions.
8. Return valid JSON only, without Markdown or code fences.

Use this exact JSON structure:

{
  "title": "Document Knowledge Quiz",
  "questions": [
    {
      "question": "Question text",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "correctAnswerText": "Exact text of the correct option",
      "explanation": "Explanation supported by the document"
    }
  ]
}

IMPORTANT:
- Generate exactly 5 questions.
- Each question must have exactly 4 options.
- correctAnswerText must be copied exactly from one of
  the four options.
- Ensure the explanation supports the selected answer.
- Use only facts present in the document.
`;

    // 5. Generate quiz using the LLM
    const rawResponse = await generateQuizContent(
      prompt,
      document.extractedText
    );

    // 6. Remove optional Markdown code fences
    const cleanedResponse = rawResponse
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");

    // 7. Parse the model's JSON response
    const quizData = JSON.parse(cleanedResponse);

    // 8. Validate the overall quiz structure
    if (
      !quizData ||
      !Array.isArray(quizData.questions) ||
      quizData.questions.length !== 5
    ) {
      throw new Error(
        "The AI returned an invalid quiz structure."
      );
    }

    // Normalize text for answer matching
    const normalizeText = (text) =>
      String(text)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

    // 9. Validate each question and derive its correct index
    const validatedQuestions = quizData.questions.map(
      (question, questionIndex) => {
        if (
          typeof question.question !== "string" ||
          !question.question.trim() ||
          !Array.isArray(question.options) ||
          question.options.length !== 4 ||
          !question.options.every(
            (option) =>
              typeof option === "string" &&
              option.trim().length > 0
          ) ||
          typeof question.correctAnswerText !== "string" ||
          !question.correctAnswerText.trim() ||
          typeof question.explanation !== "string" ||
          !question.explanation.trim()
        ) {
          throw new Error(
            `Malformed quiz question at position ${questionIndex + 1}.`
          );
        }

        // Ensure all four options are distinct
        const normalizedOptions = question.options.map(
          normalizeText
        );

        if (
          new Set(normalizedOptions).size !==
          question.options.length
        ) {
          throw new Error(
            `Duplicate options in question ${questionIndex + 1}.`
          );
        }

        // Match the answer text to one of the options
        const correctAnswer = question.options.findIndex(
          (option) =>
            normalizeText(option) ===
            normalizeText(question.correctAnswerText)
        );

        // Reject answers that don't match any option
        if (correctAnswer === -1) {
          throw new Error(
            `Correct answer does not match an option in question ${questionIndex + 1}.`
          );
        }

        // Return the format expected by the existing frontend
        return {
          question: question.question.trim(),
          options: question.options.map((option) =>
            option.trim()
          ),
          correctAnswer,
          explanation: question.explanation.trim(),
        };
      }
    );

    // 10. Return the generated quiz
    return res.status(200).json({
      success: true,
      message: "Quiz generated successfully.",
      document: {
        _id: document._id,
        title: document.title,
      },
      quiz: {
        title:
          typeof quizData.title === "string" &&
          quizData.title.trim()
            ? quizData.title.trim()
            : "Document Knowledge Quiz",
        questions: validatedQuestions,
      },
    });
  } catch (error) {
    console.error("Quiz generation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate quiz. Please try again.",
    });
  }
};

const generateDocumentFlashcards = async (req, res) => {
  try {
    const { documentId } = req.body;

    // 1. Validate document ID
    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: "Document ID is required.",
      });
    }

    // 2. Find the user's ready document
    const document = await Document.findOne({
      _id: documentId,
      userId: req.userId,
      status: "ready",
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Ready document not found.",
      });
    }

    // 3. Check extracted text
    if (!document.extractedText?.trim()) {
      return res.status(400).json({
        success: false,
        message: "No extracted text found in this document.",
      });
    }

    // 4. Create the AI prompt
    const prompt = `
You are an educational flashcard generator.

Create exactly 10 useful study flashcards based ONLY
on the provided document.

RULES:
- Each flashcard must cover an important concept,
  fact, technology, definition, or key detail.
- The question should be concise and clear.
- The answer should be accurate and easy to understand.
- Use only information explicitly supported by the document.
- Avoid duplicate or repetitive flashcards.
- Do not invent information.
- Return valid JSON only.
- Do not include Markdown or code fences.

Use this exact JSON structure:

{
  "title": "Document Study Flashcards",
  "flashcards": [
    {
      "question": "What is ...?",
      "answer": "The answer based on the document."
    }
  ]
}

Generate exactly 10 flashcards.
Each flashcard must have a non-empty question and answer.
`;

    // 5. Generate flashcards with the LLM
    const rawResponse = await generateFlashcardContent(
      prompt,
      document.extractedText
    );

    // 6. Clean possible Markdown code fences
    const cleanedResponse = rawResponse
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");

    // 7. Parse JSON
    const flashcardData = JSON.parse(cleanedResponse);

    // 8. Validate overall structure
    if (
      !flashcardData ||
      !Array.isArray(flashcardData.flashcards) ||
      flashcardData.flashcards.length !== 10
    ) {
      throw new Error(
        "The AI returned an invalid flashcard structure."
      );
    }

    // 9. Validate individual flashcards
    const validFlashcards = flashcardData.flashcards.map(
      (card, index) => {
        if (
          !card ||
          typeof card.question !== "string" ||
          !card.question.trim() ||
          typeof card.answer !== "string" ||
          !card.answer.trim()
        ) {
          throw new Error(
            `Invalid flashcard at position ${index + 1}.`
          );
        }

        return {
          question: card.question.trim(),
          answer: card.answer.trim(),
        };
      }
    );

    // 10. Return flashcards
    return res.status(200).json({
      success: true,
      message: "Flashcards generated successfully.",
      document: {
        _id: document._id,
        title: document.title,
      },
      flashcards: {
        title:
          typeof flashcardData.title === "string" &&
          flashcardData.title.trim()
            ? flashcardData.title.trim()
            : "Document Study Flashcards",
        cards: validFlashcards,
      },
    });
  } catch (error) {
    console.error("Flashcard generation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to generate flashcards. Please try again.",
    });
  }
};

const mongoose = require("mongoose");


const deleteDocument = async (req, res) => {
  let documentId;
  let cleanupStage = "status_transition";
  let deletionKey;

  try {
    ({ documentId } = req.params);

    // 1. Validate document ID
    if (!mongoose.Types.ObjectId.isValid(documentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid document ID",
      });
    }

    // 2. Find document belonging to logged-in user
    const document = await Document.findOne({
      _id: documentId,
      userId: req.userId,
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    deletionKey = String(document._id);

    if (activeUploads.has(deletionKey)) {
      return res.status(409).json({
        success: false,
        message: "Document upload is still processing. Retry deletion after it finishes.",
      });
    }

    if (activeDeletions.has(deletionKey)) {
      return res.status(409).json({
        success: false,
        message: "Document deletion is already in progress. Please retry shortly.",
      });
    }

    // Reserve this document synchronously before the first cleanup await.
    activeDeletions.add(deletionKey);

    try {
      // A persisted deleting status means this request is retrying a prior
      // partial deletion. Otherwise, atomically claim the state transition.
      if (document.status !== "deleting") {
        const statusResult = await Document.updateOne(
          {
            _id: document._id,
            userId: req.userId,
            status: document.status,
          },
          { $set: { status: "deleting" } }
        );

        if (statusResult.matchedCount !== 1) {
          const error = new Error("Document status changed before deletion started");
          error.code = "DOCUMENT_STATE_CHANGED";
          throw error;
        }
      }

      cleanupStage = "qdrant_delete";
      await qdrant.delete(COLLECTION_NAME, {
        filter: {
          must: [
            {
              key: "documentId",
              match: { value: String(document._id) },
            },
            {
              key: "userId",
              match: { value: String(req.userId) },
            },
          ],
        },
        wait: true,
      });

      cleanupStage = "chunks_delete";
      await Chunk.deleteMany({
        documentId: document._id,
        userId: req.userId,
      });

      cleanupStage = "pdf_remove";
      if (document.filePath) {
        try {
          await fs.unlink(document.filePath);
        } catch (fileError) {
          if (fileError.code !== "ENOENT") throw fileError;
        }
      }

      cleanupStage = "document_delete";
      await Document.deleteOne({
        _id: document._id,
        userId: req.userId,
        status: "deleting",
      });

      return res.status(200).json({
        success: true,
        message: "Document deleted successfully",
      });
    } finally {
      activeDeletions.delete(deletionKey);
    }

  } catch (error) {
    console.error(`[DOCUMENT_DELETE] ${cleanupStage} failed`, {
      code: error?.code || "UNKNOWN",
    });

    if (error?.code === "DOCUMENT_STATE_CHANGED") {
      return res.status(409).json({
        success: false,
        message: "Document state changed. Refresh and retry deletion.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to delete document",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  } finally {
    if (deletionKey) activeDeletions.delete(deletionKey);
  }
};

// ==========================================
// EXPORT CONTROLLERS
// ==========================================

module.exports = {
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
};
