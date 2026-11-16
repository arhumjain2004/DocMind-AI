const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const controllerPath = path.resolve(
  __dirname,
  "../src/controllers/documentController.js"
);
const originalLoad = Module._load;

const state = {};

const resetState = () => {
  Object.assign(state, {
    events: [],
    documentCreateError: null,
    extractionError: null,
    insertError: null,
    indexingError: null,
    qdrantDeleteError: null,
    chunkDeleteError: null,
    fileUnlinkError: null,
    updateErrorStatuses: new Set(),
    persistedStatus: null,
    qdrantDeleteArgs: null,
    chunkDeleteQuery: null,
    unlinks: [],
    logs: [],
  });
};

resetState();

const document = {
  _id: "doc-current-upload",
  title: "sample",
  originalName: "sample.pdf",
  fileName: "stored-sample.pdf",
  filePath: "uploads/stored-sample.pdf",
  fileType: "application/pdf",
  fileSize: 123,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  status: "processing",
};

const mocks = {
  "fs/promises": {
    unlink: async (filePath) => {
      state.events.push("file:unlink");
      state.unlinks.push(filePath);
      if (state.fileUnlinkError) throw state.fileUnlinkError;
    },
  },
  "../models/Document": {
    create: async () => {
      state.events.push("document:create");
      if (state.documentCreateError) throw state.documentCreateError;
      document.status = "processing";
      state.persistedStatus = "processing";
      return document;
    },
    updateOne: async (filter, update) => {
      const nextStatus = update.$set.status;
      state.events.push(`document:update:${nextStatus}`);
      if (state.updateErrorStatuses.has(nextStatus)) {
        const error = new Error(`update ${nextStatus} failed`);
        error.code = "SAVE_FAILED";
        throw error;
      }
      if (state.persistedStatus !== filter.status) {
        return { matchedCount: 0 };
      }
      state.persistedStatus = nextStatus;
      return { matchedCount: 1 };
    },
    findOne: async () => null,
  },
  "../models/Chunk": {
    insertMany: async (chunks) => {
      state.events.push("chunks:insert");
      if (state.insertError) throw state.insertError;
      return chunks.map((chunk, index) => ({
        ...chunk,
        _id: `chunk-${index}`,
      }));
    },
    deleteMany: async (query) => {
      state.events.push("chunks:delete");
      state.chunkDeleteQuery = query;
      if (state.chunkDeleteError) throw state.chunkDeleteError;
      return { deletedCount: 1 };
    },
  },
  "../services/qdrantService": {
    delete: async (...args) => {
      state.events.push("qdrant:delete");
      state.qdrantDeleteArgs = args;
      if (state.qdrantDeleteError) throw state.qdrantDeleteError;
    },
  },
  "../services/llmService": {
    generateAnswer: async () => "",
    generateRagAnswer: async () => ({ answer: "", claims: [], abstained: true }),
  },
  "../services/ragService": {
    buildContext: () => "",
    buildContextWithSources: () => ({ context: "", sources: [] }),
  },
  "../services/deterministicListExtractionService": {
    extractDeterministicList: () => ({ handled: false }),
  },
  "../services/searchService": { searchSimilarChunks: async () => [] },
  "../services/vectorService": {
    upsertChunks: async () => {
      state.events.push("qdrant:upsert");
      if (state.indexingError) throw state.indexingError;
    },
  },
  "../services/qdrantCollectionService": {
    createCollection: async () => {},
    COLLECTION_NAME: "docmind_chunks",
  },
  "../services/embeddingService": { generateEmbedding: async () => [] },
  "../utils/textUtils": { cleanText: (text) => String(text || "").trim() },
  "../services/chunkService": {
    createPageChunks: () => [{
      chunkIndex: 0,
      pageNumber: 1,
      text: "sample extracted text",
      characterCount: 21,
    }],
  },
  "../services/documentService": {
    extractPdfText: async () => {
      state.events.push("pdf:extract");
      if (state.extractionError) throw state.extractionError;
      return {
        text: "sample extracted text",
        pageCount: 1,
        pages: [{ pageNumber: 1, text: "sample extracted text" }],
      };
    },
  },
};

Module._load = function(request, parent, isMain) {
  if (parent && path.resolve(parent.filename) === controllerPath &&
      Object.prototype.hasOwnProperty.call(mocks, request)) {
    return mocks[request];
  }
  return originalLoad.call(this, request, parent, isMain);
};
delete require.cache[controllerPath];
const { uploadDocument } = require(controllerPath);
Module._load = originalLoad;

const invokeUpload = async ({ mimetype = "application/pdf" } = {}) => {
  const response = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await uploadDocument({
    file: {
      originalname: "sample.pdf",
      filename: "stored-sample.pdf",
      path: "uploads/stored-sample.pdf",
      mimetype,
      size: 123,
    },
    userId: "user-current",
  }, response);
  return response;
};

const makeError = (message, code) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const captureLogs = async (run) => {
  const originalError = console.error;
  console.error = (...args) => state.logs.push(args);
  try {
    return await run();
  } finally {
    console.error = originalError;
  }
};

const assertFailedResponse = (response) => {
  assert.equal(response.statusCode, 500);
  assert.equal(response.body.success, false);
  assert.equal(response.body.document, undefined);
  assert.notEqual(state.persistedStatus, "ready");
};

test("document creation failure attempts PDF cleanup", async () => {
  resetState();
  state.documentCreateError = makeError("database unavailable", "DB_ERROR");

  const response = await captureLogs(() => invokeUpload());

  assertFailedResponse(response);
  assert.deepEqual(state.events, ["document:create", "file:unlink"]);
  assert.deepEqual(state.unlinks, ["uploads/stored-sample.pdf"]);
});

test("PDF extraction failure cleans Qdrant, scoped chunks, then the file", async () => {
  resetState();
  state.extractionError = makeError("invalid PDF", "PDF_ERROR");

  const response = await captureLogs(() => invokeUpload());

  assertFailedResponse(response);
  assert.deepEqual(
    state.events.slice(-4),
    ["document:update:failed", "qdrant:delete", "chunks:delete", "file:unlink"]
  );
  assert.deepEqual(state.chunkDeleteQuery, {
    documentId: "doc-current-upload",
    userId: "user-current",
  });
});

test("chunk insertion failure triggers current-upload scoped cleanup", async () => {
  resetState();
  state.insertError = makeError("insert failed", "INSERT_ERROR");

  const response = await captureLogs(() => invokeUpload());

  assertFailedResponse(response);
  assert.ok(state.events.includes("qdrant:delete"));
  assert.ok(state.events.includes("chunks:delete"));
  assert.ok(state.events.includes("file:unlink"));
  assert.deepEqual(state.chunkDeleteQuery, {
    documentId: "doc-current-upload",
    userId: "user-current",
  });
});

test("partial Qdrant indexing is rolled back with both ownership filters and wait true", async () => {
  resetState();
  state.indexingError = makeError("upsert failed", "UPSERT_ERROR");

  const response = await captureLogs(() => invokeUpload());

  assertFailedResponse(response);
  const [collection, options] = state.qdrantDeleteArgs;
  assert.equal(collection, "docmind_chunks");
  assert.deepEqual(options, {
    filter: {
      must: [
        { key: "documentId", match: { value: "doc-current-upload" } },
        { key: "userId", match: { value: "user-current" } },
      ],
    },
    wait: true,
  });
  assert.ok(state.events.indexOf("qdrant:delete") < state.events.indexOf("chunks:delete"));
  assert.ok(state.events.indexOf("chunks:delete") < state.events.indexOf("file:unlink"));
});

test("Qdrant cleanup failure preserves chunks and PDF", async () => {
  resetState();
  state.extractionError = makeError("original processing failure", "PDF_ERROR");
  state.qdrantDeleteError = makeError("qdrant unavailable", "QDRANT_ERROR");

  const response = await captureLogs(() => invokeUpload());

  assertFailedResponse(response);
  assert.equal(state.events.includes("chunks:delete"), false);
  assert.equal(state.events.includes("file:unlink"), false);
  assert.ok(state.logs.some((args) => args[0] === "[UPLOAD_CLEANUP] qdrant_delete failed"));
});

test("MongoDB chunk cleanup failure preserves the PDF", async () => {
  resetState();
  state.extractionError = makeError("original processing failure", "PDF_ERROR");
  state.chunkDeleteError = makeError("mongo unavailable", "MONGO_ERROR");

  const response = await captureLogs(() => invokeUpload());

  assertFailedResponse(response);
  assert.ok(state.events.includes("qdrant:delete"));
  assert.ok(state.events.includes("chunks:delete"));
  assert.equal(state.events.includes("file:unlink"), false);
  assert.ok(state.logs.some((args) => args[0] === "[UPLOAD_CLEANUP] chunks_delete failed"));
});

test("ENOENT during PDF cleanup is treated as successful cleanup", async () => {
  resetState();
  state.extractionError = makeError("original processing failure", "PDF_ERROR");
  state.fileUnlinkError = makeError("already removed", "ENOENT");

  const response = await captureLogs(() => invokeUpload());

  assertFailedResponse(response);
  assert.equal(state.events.includes("file:unlink"), true);
  assert.equal(state.logs.some((args) => String(args[0]).includes("pdf_remove")), false);
});

test("other PDF removal errors are logged without replacing the processing failure", async () => {
  resetState();
  state.extractionError = makeError("original processing failure", "PDF_ERROR");
  state.fileUnlinkError = makeError("disk unavailable", "EIO");

  const response = await captureLogs(() => invokeUpload());

  assertFailedResponse(response);
  assert.equal(response.body.message, "Failed to process PDF");
  assert.ok(state.logs.some((args) =>
    args[0] === "[UPLOAD_CLEANUP] pdf_remove failed" &&
    args[1]?.code === "EIO"
  ));
  assert.ok(state.logs.some((args) =>
    args[0] === "PDF processing error:" &&
    args[1]?.message === "original processing failure"
  ));
});

test("failure to save failed status does not crash cleanup or return success", async () => {
  resetState();
  state.extractionError = makeError("original processing failure", "PDF_ERROR");
  state.updateErrorStatuses.add("failed");

  const response = await captureLogs(() => invokeUpload());

  assertFailedResponse(response);
  assert.ok(state.events.includes("qdrant:delete"));
  assert.ok(state.events.includes("chunks:delete"));
  assert.ok(state.events.includes("file:unlink"));
  assert.ok(state.logs.some((args) => args[0] === "[UPLOAD_CLEANUP] status_failed failed"));
});

test("failure to save ready status rolls back and returns an upload failure", async () => {
  resetState();
  state.updateErrorStatuses.add("ready");

  const response = await captureLogs(() => invokeUpload());

  assertFailedResponse(response);
  assert.ok(state.events.includes("qdrant:delete"));
  assert.ok(state.events.includes("chunks:delete"));
  assert.ok(state.events.includes("file:unlink"));
  assert.ok(state.events.includes("document:update:failed"));
});

test("MIME rejection removes the just-uploaded file", async () => {
  resetState();

  const response = await captureLogs(() => invokeUpload({ mimetype: "application/octet-stream" }));

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.success, false);
  assert.deepEqual(state.events, ["file:unlink"]);
  assert.equal(state.events.includes("document:create"), false);
});

test("successful upload marks ready only after Qdrant indexing and preserves API shape", async () => {
  resetState();

  const response = await captureLogs(() => invokeUpload());

  assert.equal(response.statusCode, 201);
  assert.deepEqual(Object.keys(response.body), ["success", "message", "document"]);
  assert.equal(response.body.success, true);
  assert.equal(response.body.document.status, "ready");
  assert.ok(state.events.indexOf("qdrant:upsert") < state.events.indexOf("document:update:ready"));
  assert.equal(state.persistedStatus, "ready");
  assert.equal(state.events.includes("qdrant:delete"), false);
  assert.equal(state.events.includes("file:unlink"), false);
});
