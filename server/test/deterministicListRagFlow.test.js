const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const { buildContextWithSources } = require("../src/services/ragService");
const { extractDeterministicList } = require("../src/services/deterministicListExtractionService");
const controllerPath = path.resolve(__dirname, "../src/controllers/documentController.js");
const originalLoad = Module._load;

let searchResults = [];
let ragGenerationCalls = 0;
const document = { _id: "document-1", title: "Evaluation Rubric" };
const llmMock = {
  generateAnswer: async () => "generic answer",
  generateRagAnswer: async () => {
    ragGenerationCalls += 1;
    return { answer: "Ollama RAG answer", claims: [], abstained: false };
  },
};

Module._load = function(request, parent, isMain) {
  if (parent && path.resolve(parent.filename) === controllerPath) {
    const mocks = {
      "../models/Document": { findOne: async () => document },
      "../models/Chunk": {},
      "../services/qdrantService": {},
      "../services/llmService": llmMock,
      "../services/ragService": { buildContext: (...args) => require("../src/services/ragService").buildContext(...args), buildContextWithSources },
      "../services/searchService": { searchSimilarChunks: async () => searchResults },
      "../services/vectorService": {},
      "../services/qdrantCollectionService": { COLLECTION_NAME: "test" },
      "../services/embeddingService": {},
      "../utils/textUtils": {},
      "../services/chunkService": {},
      "../services/documentService": {},
      "../services/deterministicListExtractionService": { extractDeterministicList },
    };
    if (Object.prototype.hasOwnProperty.call(mocks, request)) return mocks[request];
  }
  return originalLoad.call(this, request, parent, isMain);
};

delete require.cache[controllerPath];
const { askDocument } = require(controllerPath);
Module._load = originalLoad;

const table = [
  "| Area | Weight |",
  "| --- | --- |",
  "| Layout, visual design, and consistency | 25% |",
  "| Responsive design (mobile and desktop) | 20% |",
  "| Code structure and readability | 20% |",
  "| Working navigation, buttons, and form interactions | 20% |",
  "| Submission quality and explanation | 15% |",
].join("\n");

const makeResult = (text) => ({
  score: 0.421,
  payload: {
    documentId: "document-1",
    chunkId: "chunk-1",
    chunkIndex: 4,
    pageNumber: 2,
    text,
  },
});

const invokeAsk = async (query) => {
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await askDocument({
    body: { query, documentId: "document-1" },
    userId: "user-1",
  }, res);
  return res;
};

test("complete list uses deterministic answer and preserves source metadata", async () => {
  searchResults = [makeResult(table)];
  ragGenerationCalls = 0;

  const response = await invokeAsk("What are the five evaluation criteria and their weightages?");

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.match(response.body.answer, /Submission quality and explanation — 15% \[SOURCE 1\]/);
  assert.equal(response.body.sources.length, 1);
  assert.equal(response.body.sources[0].pageNumber, 2);
  assert.equal(response.body.sources[0].score, 0.421);
  assert.equal(ragGenerationCalls, 0);
});

test("classified list abstains on extraction failure without falling back to Ollama", async () => {
  const fourRows = table.split("\n").slice(0, 6).join("\n");
  searchResults = [makeResult(fourRows)];
  ragGenerationCalls = 0;

  const response = await invokeAsk("What are the five evaluation criteria and their weightages?");

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.answer, "I couldn't find this information in the provided document.");
  assert.equal(response.body.sources.length, 1);
  assert.equal(ragGenerationCalls, 0);
});

test("ordinary RAG question continues to use the existing Ollama path", async () => {
  searchResults = [makeResult(table)];
  ragGenerationCalls = 0;

  const response = await invokeAsk("What is the purpose of the evaluation rubric?");

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.answer, "Ollama RAG answer");
  assert.equal(ragGenerationCalls, 1);
});
