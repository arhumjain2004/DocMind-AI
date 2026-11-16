const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const searchServicePath = path.resolve(__dirname, "../src/services/searchService.js");

const loadSearchService = ({ query, generateEmbedding = async () => Array(384).fill(0) }) => {
  const originalLoad = Module._load;
  const qdrant = { query };
  Module._load = function(request, parent, isMain) {
    if (parent && path.resolve(parent.filename) === searchServicePath) {
      if (request === "./qdrantService") return qdrant;
      if (request === "./qdrantCollectionService") return { COLLECTION_NAME: "docmind_chunks" };
      if (request === "./embeddingService") return { generateEmbedding };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  delete require.cache[searchServicePath];
  try {
    return require(searchServicePath);
  } finally {
    Module._load = originalLoad;
    delete require.cache[searchServicePath];
  }
};

const USER_ID = "user-1";
const DOCUMENT_ID = "document-1";

const validPoint = (overrides = {}) => ({
  id: "point-1",
  score: 0.5,
  payload: {
    chunkId: "chunk-1",
    documentId: DOCUMENT_ID,
    userId: USER_ID,
    chunkIndex: 0,
    pageNumber: 1,
    text: "Evidence text",
  },
  ...overrides,
});

const runSearch = (searchSimilarChunks, userId = USER_ID, documentId = DOCUMENT_ID) =>
  searchSimilarChunks("question", userId, documentId, 3);

test("search uses top-K 3 and both ownership filters", async () => {
  let request;
  const { searchSimilarChunks } = loadSearchService({
    query: async (_collection, options) => {
      request = { collection: _collection, options };
      return { points: [validPoint()] };
    },
  });

  const results = await runSearch(searchSimilarChunks);

  assert.equal(request.collection, "docmind_chunks");
  assert.equal(request.options.limit, 3);
  assert.equal(request.options.with_payload, true);
  assert.deepEqual(request.options.filter, {
    must: [
      { key: "userId", match: { value: USER_ID } },
      { key: "documentId", match: { value: DOCUMENT_ID } },
    ],
  });
  assert.equal(results.length, 1);
});

test("score below 0.195 is filtered and score equal to 0.195 is retained", async () => {
  const { searchSimilarChunks } = loadSearchService({
    query: async () => ({
      points: [
        validPoint({ id: "below", score: 0.194999 }),
        validPoint({ id: "at-threshold", score: 0.195 }),
      ],
    }),
  });

  const results = await runSearch(searchSimilarChunks);
  assert.deepEqual(results.map(({ id }) => id), ["at-threshold"]);
});

test("a valid empty points array remains a successful empty search", async () => {
  const { searchSimilarChunks } = loadSearchService({ query: async () => ({ points: [] }) });
  assert.deepEqual(await runSearch(searchSimilarChunks), []);
});

test("Qdrant rejection propagates instead of becoming an empty search", async () => {
  const qdrantError = new Error("Qdrant unavailable");
  const { searchSimilarChunks } = loadSearchService({ query: async () => { throw qdrantError; } });
  await assert.rejects(runSearch(searchSimilarChunks), (error) => error === qdrantError);
});

test("missing or malformed Qdrant responses throw a controlled retrieval error", async (t) => {
  for (const [name, response] of [
    ["missing response", undefined],
    ["missing points", {}],
    ["non-array points", { points: null }],
  ]) {
    await t.test(name, async () => {
      const { searchSimilarChunks } = loadSearchService({ query: async () => response });
      await assert.rejects(runSearch(searchSimilarChunks), (error) => {
        assert.equal(error.code, "QDRANT_INVALID_RESPONSE");
        return true;
      });
    });
  }
});

test("malformed points, invalid scores, and incomplete payloads are rejected before downstream context use", async (t) => {
  const cases = [
    ["null point", null],
    ["nonnumeric score", validPoint({ score: "0.5" })],
    ["NaN score", validPoint({ score: Number.NaN })],
    ["infinite score", validPoint({ score: Number.POSITIVE_INFINITY })],
    ["missing payload", validPoint({ payload: undefined })],
    ["missing text", validPoint({ payload: { ...validPoint().payload, text: " " } })],
    ["missing page number", validPoint({ payload: { ...validPoint().payload, pageNumber: undefined } })],
    ["invalid page number", validPoint({ payload: { ...validPoint().payload, pageNumber: 0 } })],
    ["missing document identifier", validPoint({ payload: { ...validPoint().payload, documentId: "" } })],
    ["mismatched document identifier", validPoint({ payload: { ...validPoint().payload, documentId: "other-document" } })],
    ["missing user identifier", validPoint({ payload: { ...validPoint().payload, userId: "" } })],
    ["mismatched user identifier", validPoint({ payload: { ...validPoint().payload, userId: "other-user" } })],
    ["missing chunk metadata", validPoint({ payload: { ...validPoint().payload, chunkIndex: undefined } })],
  ];

  for (const [name, point] of cases) {
    await t.test(name, async () => {
      let contextConstructionReached = false;
      const { searchSimilarChunks } = loadSearchService({ query: async () => ({ points: [point] }) });
      await assert.rejects(async () => {
        const results = await runSearch(searchSimilarChunks);
        contextConstructionReached = true;
        return results;
      }, (error) => error.code === "QDRANT_INVALID_RESPONSE");
      assert.equal(contextConstructionReached, false);
    });
  }
});

test("embedding failures remain distinguishable from an empty Qdrant result", async () => {
  const embeddingError = new Error("embedding unavailable");
  let qdrantCalled = false;
  const { searchSimilarChunks } = loadSearchService({
    generateEmbedding: async () => { throw embeddingError; },
    query: async () => { qdrantCalled = true; return { points: [] }; },
  });

  await assert.rejects(runSearch(searchSimilarChunks), (error) => error === embeddingError);
  assert.equal(qdrantCalled, false);
});
