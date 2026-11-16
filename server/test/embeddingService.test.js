const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const embeddingServicePath = path.resolve(__dirname, "../src/services/embeddingService.js");

const loadEmbeddingService = (pipeline) => {
  const originalLoad = Module._load;
  Module._load = function(request, parent, isMain) {
    if (
      parent &&
      path.resolve(parent.filename) === embeddingServicePath &&
      request === "@huggingface/transformers"
    ) {
      return { pipeline };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  delete require.cache[embeddingServicePath];
  try {
    return require(embeddingServicePath);
  } finally {
    Module._load = originalLoad;
    delete require.cache[embeddingServicePath];
  }
};

const vectorOf = (length = 384, valueAt = () => 0.25) =>
  Array.from({ length }, (_, index) => valueAt(index));

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

test("successful initialization preserves model, pooling, normalization, and embedding values", async () => {
  const vector = vectorOf(384, (index) => index / 1000);
  const calls = { pipeline: [], extractor: [] };
  const extractor = async (...args) => {
    calls.extractor.push(args);
    return { data: Float64Array.from(vector) };
  };
  const { generateEmbedding } = loadEmbeddingService((...args) => {
    calls.pipeline.push(args);
    return Promise.resolve(extractor);
  });

  const result = await generateEmbedding("source question");

  assert.deepEqual(calls.pipeline, [["feature-extraction", "Xenova/all-MiniLM-L6-v2"]]);
  assert.deepEqual(calls.extractor, [["source question", { pooling: "mean", normalize: true }]]);
  assert.equal(result.length, 384);
  assert.deepEqual(result, vector);
});

test("concurrent calls share one model pipeline initialization", async () => {
  const initialization = deferred();
  let pipelineCalls = 0;
  const extractor = async (text) => ({ data: vectorOf(384, () => text.length / 100) });
  const { generateEmbedding } = loadEmbeddingService(() => {
    pipelineCalls += 1;
    return initialization.promise;
  });

  const first = generateEmbedding("first");
  const second = generateEmbedding("second");
  await Promise.resolve();
  assert.equal(pipelineCalls, 1);

  initialization.resolve(extractor);
  const [firstVector, secondVector] = await Promise.all([first, second]);

  assert.equal(firstVector.length, 384);
  assert.equal(secondVector.length, 384);
  assert.equal(firstVector[0], 0.05);
  assert.equal(secondVector[0], 0.06);
});

test("a rejected initialization is cleared and a later call can retry", async () => {
  let pipelineCalls = 0;
  const extractor = async () => ({ data: Float32Array.from(vectorOf()) });
  const { generateEmbedding } = loadEmbeddingService(() => {
    pipelineCalls += 1;
    return pipelineCalls === 1
      ? Promise.reject(new Error("temporary initialization failure"))
      : Promise.resolve(extractor);
  });

  await assert.rejects(generateEmbedding("first attempt"), /temporary initialization failure/);
  const result = await generateEmbedding("retry");

  assert.equal(pipelineCalls, 2);
  assert.equal(result.length, 384);
});

test("embeddings with an incorrect dimension count are rejected", async () => {
  const { generateEmbedding } = loadEmbeddingService(() => async () => ({ data: vectorOf(383) }));

  await assert.rejects(
    generateEmbedding("dimension mismatch"),
    /exactly 384 dimensions; received 383/
  );
});

test("empty and invalid embedding output is rejected clearly", async (t) => {
  await t.test("empty vector", async () => {
    const { generateEmbedding } = loadEmbeddingService(() => async () => ({ data: [] }));
    await assert.rejects(generateEmbedding("empty"), /empty vector/);
  });

  await t.test("missing data", async () => {
    const { generateEmbedding } = loadEmbeddingService(() => async () => ({}));
    await assert.rejects(generateEmbedding("missing"), /invalid or empty output/);
  });
});

test("NaN, Infinity, and nonnumeric vector values are rejected", async (t) => {
  for (const [label, invalidValue] of [
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["nonnumeric", "0.5"],
  ]) {
    await t.test(label, async () => {
      const values = vectorOf();
      values[17] = invalidValue;
      const { generateEmbedding } = loadEmbeddingService(() => async () => ({ data: values }));
      await assert.rejects(generateEmbedding(label), /finite numbers/);
    });
  }
});
