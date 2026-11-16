const { pipeline } = require("@huggingface/transformers");

let embeddingPipeline = null;

const getEmbeddingPipeline = async () => {
  if (!embeddingPipeline) {
    const initialization = Promise.resolve().then(() =>
      pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2"
      )
    );
    embeddingPipeline = initialization;

    initialization.catch(() => {
      if (embeddingPipeline === initialization) {
        embeddingPipeline = null;
      }
    });
  }

  return await embeddingPipeline;
};

const generateEmbedding = async (text) => {
  const extractor = await getEmbeddingPipeline();

  const output = await extractor(text, {
    pooling: "mean",
    normalize: true,
  });

  if (!output || output.data == null) {
    throw new Error("Embedding model returned invalid or empty output");
  }

  let vector;
  try {
    vector = Array.from(output.data);
  } catch {
    throw new Error("Embedding model returned invalid or empty output");
  }

  if (vector.length === 0) {
    throw new Error("Embedding model returned an empty vector");
  }

  if (vector.length !== 384) {
    throw new Error(`Embedding vector must contain exactly 384 dimensions; received ${vector.length}`);
  }

  if (!vector.every((value) => typeof value === "number" && Number.isFinite(value))) {
    throw new Error("Embedding vector values must all be finite numbers");
  }

  return vector;
};

module.exports = {
  generateEmbedding,
};
