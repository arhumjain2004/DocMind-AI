
const qdrant = require("./qdrantService");

const {
  COLLECTION_NAME,
} = require("./qdrantCollectionService");

const {
  generateEmbedding,
} = require("./embeddingService");

const MIN_SIMILARITY_SCORE = 0.195;

class RetrievalResponseError extends Error {
  constructor(message) {
    super(message);
    this.name = "RetrievalResponseError";
    this.code = "QDRANT_INVALID_RESPONSE";
  }
}

const validatePoint = (point, userId, documentId, index) => {
  if (!point || typeof point !== "object" || Array.isArray(point)) {
    throw new RetrievalResponseError(`Qdrant returned an invalid point at index ${index}`);
  }

  if (typeof point.score !== "number" || !Number.isFinite(point.score)) {
    throw new RetrievalResponseError(`Qdrant returned an invalid score at index ${index}`);
  }

  const payload = point.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new RetrievalResponseError(`Qdrant returned an invalid payload at index ${index}`);
  }

  const requiredTextFields = ["chunkId", "documentId", "userId", "text"];
  if (requiredTextFields.some((field) => typeof payload[field] !== "string" || !payload[field].trim())) {
    throw new RetrievalResponseError(`Qdrant returned incomplete payload fields at index ${index}`);
  }

  if (
    !Number.isInteger(payload.chunkIndex) ||
    payload.chunkIndex < 0 ||
    !Number.isInteger(payload.pageNumber) ||
    payload.pageNumber < 1
  ) {
    throw new RetrievalResponseError(`Qdrant returned invalid chunk metadata at index ${index}`);
  }

  if (
    payload.userId !== userId.toString() ||
    payload.documentId !== documentId.toString()
  ) {
    throw new RetrievalResponseError(`Qdrant returned a point outside the requested scope at index ${index}`);
  }
};

const searchSimilarChunks = async (
  query,
  userId,
  documentId,
  limit = 3
) => {
  // Convert the user's question into an embedding
  const queryVector = await generateEmbedding(query);

  // Search Qdrant using the current query API
  const results = await qdrant.query(
    COLLECTION_NAME,
    {
      query: queryVector,
      limit,
      with_payload: true,
      filter: {
        must: [
          {
            key: "userId",
            match: {
              value: userId.toString(),
            },
          },
          {
            key: "documentId",
            match: {
              value: documentId.toString(),
            },
          },
        ],
      },
    }
  );

  if (!results || typeof results !== "object" || !Array.isArray(results.points)) {
    throw new RetrievalResponseError("Qdrant returned a malformed search response");
  }

  results.points.forEach((point, index) => validatePoint(point, userId, documentId, index));

  return results.points.filter(
    (point) =>
      point.score >= MIN_SIMILARITY_SCORE
  );
};

module.exports = {
  searchSimilarChunks,
  RetrievalResponseError,
};
