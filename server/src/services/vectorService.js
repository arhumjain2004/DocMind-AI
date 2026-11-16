const crypto = require("crypto");

const qdrant = require("./qdrantService");

const {
  COLLECTION_NAME,
} = require("./qdrantCollectionService");

const {
  generateEmbedding,
} = require("./embeddingService");

const createPointId = (chunkId) => {
  const hash = crypto
    .createHash("sha256")
    .update(chunkId.toString())
    .digest("hex")
    .slice(0, 32);

  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join("-");
};

const upsertChunk = async (chunk) => {
  const vector = await generateEmbedding(chunk.text);

  const pointId = createPointId(chunk._id);

  await qdrant.upsert(COLLECTION_NAME, {
    wait: true,

    points: [
      {
        id: pointId,

        vector,

        payload: {
          chunkId: chunk._id.toString(),
          documentId: chunk.documentId.toString(),
          userId: chunk.userId.toString(),
          chunkIndex: chunk.chunkIndex,
          pageNumber: chunk.pageNumber,
          text: chunk.text,
        },
      },
    ],
  });
};

const upsertChunks = async (chunks) => {
  for (const chunk of chunks) {
    await upsertChunk(chunk);
  }
};

module.exports = {
  upsertChunk,
  upsertChunks,
};
