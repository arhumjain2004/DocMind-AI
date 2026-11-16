const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const DOCUMENT_ID = "64b000000000000000000001";
const USER_ID = "64b000000000000000000002";
const OTHER_USER_ID = "64b000000000000000000003";
const FILE_PATH = "uploads/document-under-test.pdf";
const controllerPath = path.resolve(
  __dirname,
  "../src/controllers/documentController.js"
);
const originalLoad = Module._load;
const state = {};

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const resetState = () => {
  state.events = [];
  state.status = "ready";
  state.documentPresent = true;
  state.statusUpdateError = null;
  state.qdrantError = null;
  state.chunkDeleteError = null;
  state.fileError = null;
  state.documentDeleteError = null;
  state.qdrantArgs = [];
  state.chunkQuery = null;
  state.documentUpdateQueries = [];
  state.documentDeleteQuery = null;
  state.findQueries = [];
  state.logs = [];
  state.qdrantGate = null;
  state.qdrantStarted = deferred();
  state.upsertGate = null;
  state.upsertStarted = deferred();
  state.forceDeletingDuringUpsert = false;
};

resetState();

const mockDocument = {
  _id: DOCUMENT_ID,
  userId: USER_ID,
  title: "Sample document",
  originalName: "document-under-test.pdf",
  fileName: "stored-document.pdf",
  filePath: FILE_PATH,
  fileType: "application/pdf",
  fileSize: 123,
  pageCount: 1,
  extractedText: "Existing text",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

const mocks = {
  "fs/promises": {
    unlink: async (filePath) => {
      state.events.push("file:unlink");
      state.unlinkedPath = filePath;
      if (state.fileError) throw state.fileError;
    },
  },
  mongoose: {
    Types: {
      ObjectId: {
        isValid: (value) => value === DOCUMENT_ID,
      },
    },
  },
  "../models/Document": {
    findOne: async (query) => {
      state.findQueries.push(query);
      if (!state.documentPresent || query._id !== DOCUMENT_ID || query.userId !== USER_ID) {
        return null;
      }
      if (query.status?.$ne && state.status === query.status.$ne) return null;
      return { ...mockDocument, status: state.status };
    },
    create: async (data) => {
      state.events.push("document:create");
      state.documentPresent = true;
      state.status = data.status;
      return {
        ...mockDocument,
        ...data,
        _id: DOCUMENT_ID,
        save: async () => {},
      };
    },
    updateOne: async (query, update) => {
      state.events.push(`document:update:${update.$set.status}`);
      state.documentUpdateQueries.push(query);
      if (state.statusUpdateError) throw state.statusUpdateError;
      if (
        !state.documentPresent ||
        query._id !== DOCUMENT_ID ||
        query.userId !== USER_ID ||
        query.status !== state.status
      ) {
        return { matchedCount: 0 };
      }
      Object.assign(state, update.$set);
      if (update.$set.status) state.status = update.$set.status;
      return { matchedCount: 1 };
    },
    deleteOne: async (query) => {
      state.events.push("document:delete");
      state.documentDeleteQuery = query;
      if (state.documentDeleteError) throw state.documentDeleteError;
      if (
        !state.documentPresent ||
        query._id !== DOCUMENT_ID ||
        query.userId !== USER_ID ||
        query.status !== "deleting"
      ) {
        return { deletedCount: 0 };
      }
      state.documentPresent = false;
      return { deletedCount: 1 };
    },
  },
  "../models/Chunk": {
    find: () => ({ sort: async () => [] }),
    insertMany: async (chunks) => chunks.map((chunk, index) => ({ ...chunk, _id: `chunk-${index}` })),
    deleteMany: async (query) => {
      state.events.push("chunks:delete");
      state.chunkQuery = query;
      if (state.chunkDeleteError) throw state.chunkDeleteError;
      return { deletedCount: 1 };
    },
  },
  "../services/qdrantService": {
    delete: async (...args) => {
      state.events.push("qdrant:delete");
      state.qdrantArgs.push(args);
      state.qdrantStarted.resolve();
      if (state.qdrantError) throw state.qdrantError;
      if (state.qdrantGate) await state.qdrantGate.promise;
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
      state.upsertStarted.resolve();
      if (state.forceDeletingDuringUpsert) state.status = "deleting";
      if (state.upsertGate) await state.upsertGate.promise;
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
    extractPdfText: async () => ({
      text: "sample extracted text",
      pageCount: 1,
      pages: [{ pageNumber: 1, text: "sample extracted text" }],
    }),
  },
};

Module._load = function(request, parent, isMain) {
  if (
    parent &&
    path.resolve(parent.filename) === controllerPath &&
    Object.prototype.hasOwnProperty.call(mocks, request)
  ) {
    return mocks[request];
  }
  return originalLoad.call(this, request, parent, isMain);
};
delete require.cache[controllerPath];
const { deleteDocument, getDocumentChunks, uploadDocument } = require(controllerPath);
Module._load = originalLoad;

const makeResponse = () => ({
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
});

const invokeDelete = async (userId = USER_ID) => {
  const response = makeResponse();
  await deleteDocument({ params: { documentId: DOCUMENT_ID }, userId }, response);
  return response;
};

const invokeUpload = async () => {
  const response = makeResponse();
  await uploadDocument({
    file: {
      originalname: "document-under-test.pdf",
      filename: "stored-document.pdf",
      path: FILE_PATH,
      mimetype: "application/pdf",
      size: 123,
    },
    userId: USER_ID,
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

test("Document schema includes deleting and preserves existing statuses", () => {
  const DocumentModel = require("../src/models/Document");
  const statuses = DocumentModel.schema.path("status").enumValues;
  assert.deepEqual(statuses, ["processing", "ready", "failed", "deleting"]);
  assert.equal(DocumentModel.schema.path("status").defaultValue, "processing");
});

test("deleting status is atomically saved before cleanup and ownership is retained", async () => {
  resetState();
  const response = await captureLogs(() => invokeDelete());

  assert.equal(response.statusCode, 200);
  assert.deepEqual(state.events, [
    "document:update:deleting",
    "qdrant:delete",
    "chunks:delete",
    "file:unlink",
    "document:delete",
  ]);
  assert.deepEqual(state.documentUpdateQueries[0], {
    _id: DOCUMENT_ID,
    userId: USER_ID,
    status: "ready",
  });
});

test("failed status transition prevents all destructive cleanup", async () => {
  resetState();
  state.statusUpdateError = makeError("status write failed", "MONGO_ERROR");

  const response = await captureLogs(() => invokeDelete());

  assert.equal(response.statusCode, 500);
  assert.equal(response.body.success, false);
  assert.equal(state.events.includes("qdrant:delete"), false);
  assert.equal(state.events.includes("chunks:delete"), false);
  assert.equal(state.events.includes("file:unlink"), false);
  assert.equal(state.documentPresent, true);
  assert.equal(state.status, "ready");
});

test("Qdrant deletion uses the shared collection, both filters, and wait true", async () => {
  resetState();
  await captureLogs(() => invokeDelete());

  assert.deepEqual(state.qdrantArgs[0], ["docmind_chunks", {
    filter: {
      must: [
        { key: "documentId", match: { value: DOCUMENT_ID } },
        { key: "userId", match: { value: USER_ID } },
      ],
    },
    wait: true,
  }]);
  assert.deepEqual(state.chunkQuery, { documentId: DOCUMENT_ID, userId: USER_ID });
});

test("Qdrant failure keeps chunks, PDF, and deleting document for retry", async () => {
  resetState();
  state.qdrantError = makeError("qdrant unavailable", "QDRANT_ERROR");

  const response = await captureLogs(() => invokeDelete());

  assert.equal(response.statusCode, 500);
  assert.equal(state.status, "deleting");
  assert.equal(state.documentPresent, true);
  assert.equal(state.events.includes("chunks:delete"), false);
  assert.equal(state.events.includes("file:unlink"), false);
  assert.ok(state.logs.some((args) => args[0] === "[DOCUMENT_DELETE] qdrant_delete failed"));
});

test("chunk deletion failure preserves the PDF and document", async () => {
  resetState();
  state.chunkDeleteError = makeError("mongo unavailable", "MONGO_ERROR");

  const response = await captureLogs(() => invokeDelete());

  assert.equal(response.statusCode, 500);
  assert.equal(state.status, "deleting");
  assert.equal(state.documentPresent, true);
  assert.equal(state.events.includes("file:unlink"), false);
  assert.ok(state.logs.some((args) => args[0] === "[DOCUMENT_DELETE] chunks_delete failed"));
});

test("PDF ENOENT is treated as success and the document is removed last", async () => {
  resetState();
  state.fileError = makeError("file already absent", "ENOENT");

  const response = await captureLogs(() => invokeDelete());

  assert.equal(response.statusCode, 200);
  assert.equal(state.documentPresent, false);
  assert.equal(state.events.at(-1), "document:delete");
});

test("other filesystem errors retain deleting document and return failure", async () => {
  resetState();
  state.fileError = makeError("access denied", "EACCES");

  const response = await captureLogs(() => invokeDelete());

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, {
    success: false,
    message: "Failed to delete document",
    error: undefined,
  });
  assert.equal(state.status, "deleting");
  assert.equal(state.documentPresent, true);
  assert.equal(state.events.includes("document:delete"), false);
  assert.ok(state.logs.some((args) =>
    args[0] === "[DOCUMENT_DELETE] pdf_remove failed" && args[1]?.code === "EACCES"
  ));
});

test("document record is deleted only after vectors, chunks, and file", async () => {
  resetState();
  const response = await captureLogs(() => invokeDelete());

  assert.equal(response.statusCode, 200);
  assert.ok(state.events.indexOf("qdrant:delete") < state.events.indexOf("chunks:delete"));
  assert.ok(state.events.indexOf("chunks:delete") < state.events.indexOf("file:unlink"));
  assert.ok(state.events.indexOf("file:unlink") < state.events.indexOf("document:delete"));
  assert.deepEqual(state.documentDeleteQuery, {
    _id: DOCUMENT_ID,
    userId: USER_ID,
    status: "deleting",
  });
});

test("retry after Qdrant failure repeats idempotent cleanup and completes", async () => {
  resetState();
  state.qdrantError = makeError("temporary outage", "QDRANT_ERROR");
  const first = await captureLogs(() => invokeDelete());
  assert.equal(first.statusCode, 500);
  assert.equal(state.status, "deleting");

  state.qdrantError = null;
  const retry = await captureLogs(() => invokeDelete());

  assert.equal(retry.statusCode, 200);
  assert.equal(state.qdrantArgs.length, 2);
  assert.equal(state.documentPresent, false);
  assert.equal(state.events.filter((event) => event === "document:update:deleting").length, 1);
});

test("document deletion failure after file removal remains retryable", async () => {
  resetState();
  state.documentDeleteError = makeError("mongo unavailable", "MONGO_ERROR");
  const first = await captureLogs(() => invokeDelete());
  assert.equal(first.statusCode, 500);
  assert.equal(state.documentPresent, true);
  assert.equal(state.status, "deleting");

  state.documentDeleteError = null;
  const retry = await captureLogs(() => invokeDelete());
  assert.equal(retry.statusCode, 200);
  assert.equal(state.documentPresent, false);
  assert.equal(state.unlinkedPath, FILE_PATH);
});

test("concurrent delete request is rejected while cleanup is active", async () => {
  resetState();
  state.qdrantGate = deferred();
  const firstPromise = captureLogs(() => invokeDelete());
  await state.qdrantStarted.promise;

  const second = await captureLogs(() => invokeDelete());
  assert.equal(second.statusCode, 409);
  assert.match(second.body.message, /already in progress/i);
  assert.equal(state.qdrantArgs.length, 1);

  state.qdrantGate.resolve();
  const first = await firstPromise;
  assert.equal(first.statusCode, 200);
});

test("upload cannot overwrite deleting with ready or failed", async () => {
  resetState();
  state.forceDeletingDuringUpsert = true;

  const response = await captureLogs(() => invokeUpload());

  assert.equal(response.statusCode, 500);
  assert.equal(response.body.success, false);
  assert.equal(state.status, "deleting");
  assert.equal(state.events.includes("document:update:ready"), true);
  assert.equal(state.events.includes("document:update:failed"), true);
});

test("deletion during an active upload is rejected until upload finishes", async () => {
  resetState();
  state.upsertGate = deferred();
  const uploadPromise = captureLogs(() => invokeUpload());
  await state.upsertStarted.promise;

  const deletion = await captureLogs(() => invokeDelete());
  assert.equal(deletion.statusCode, 409);
  assert.match(deletion.body.message, /upload is still processing/i);
  assert.equal(state.events.includes("document:update:deleting"), false);

  state.upsertGate.resolve();
  const upload = await uploadPromise;
  assert.equal(upload.statusCode, 201);
  assert.equal(state.status, "ready");
});

test("getDocumentChunks rejects deleting documents", async () => {
  resetState();
  state.status = "deleting";
  const response = makeResponse();

  await getDocumentChunks({ params: { documentId: DOCUMENT_ID }, userId: USER_ID }, response);

  assert.equal(response.statusCode, 404);
  assert.deepEqual(state.findQueries[0], {
    _id: DOCUMENT_ID,
    userId: USER_ID,
    status: { $ne: "deleting" },
  });
});

test("another user's request cannot transition or clean this document", async () => {
  resetState();
  const response = await captureLogs(() => invokeDelete(OTHER_USER_ID));

  assert.equal(response.statusCode, 404);
  assert.equal(state.documentUpdateQueries.length, 0);
  assert.equal(state.qdrantArgs.length, 0);
  assert.equal(state.chunkQuery, null);
  assert.equal(state.events.includes("file:unlink"), false);
});

test("successful deletion retains the existing response structure", async () => {
  resetState();
  const response = await captureLogs(() => invokeDelete());

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    message: "Document deleted successfully",
  });
});
