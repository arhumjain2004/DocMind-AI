const test = require("node:test");
const assert = require("node:assert/strict");

const {
  generateAnswer,
  generateRagAnswer,
} = require("../src/services/llmService");

const validRagJson = JSON.stringify({
  answer: "The document defines the service clearly.",
  claims: [
    {
      text: "The document defines the service clearly.",
      sourceLabels: ["SOURCE 1"],
    },
  ],
  abstained: false,
});

const withMockedFetch = async (handler, callback) => {
  const originalFetch = global.fetch;
  const originalLog = console.log;
  const originalError = console.error;
  const requests = [];

  global.fetch = async (url, options) => {
    const payload = JSON.parse(options.body);
    requests.push({ url, options, payload });
    const result = await handler(payload, requests.length);
    const body = { message: { content: result.content } };
    if (result.metadata !== undefined) Object.assign(body, result.metadata);

    return {
      ok: true,
      json: async () => body,
    };
  };
  console.log = () => {};
  console.error = () => {};

  try {
    await callback(requests);
  } finally {
    global.fetch = originalFetch;
    console.log = originalLog;
    console.error = originalError;
  }
};

const runRag = () => generateRagAnswer(
  "What does the document say?",
  "SOURCE 1\nDocument ID: doc-1\nChunk: 0\nPage: 1\n\nThe document defines the service clearly.",
  ["SOURCE 1"]
);

test("valid RAG response with completion metadata keeps its answer and citations", async () => {
  await withMockedFetch(async () => ({
    content: validRagJson,
    metadata: { done: true, done_reason: "stop", eval_count: 80, prompt_eval_count: 500 },
  }), async (requests) => {
    const result = await runRag();

    assert.equal(result.abstained, false);
    assert.equal(result.claims.length, 1);
    assert.equal(result.answer, "The document defines the service clearly. [SOURCE 1]");
    assert.equal(requests.length, 1);
    assert.equal(requests[0].payload.options.num_ctx, 4096);
    assert.equal(requests[0].payload.options.num_predict, 768);
    assert.equal(typeof requests[0].payload.format, "object");
  });
});

test("valid RAG response without optional completion metadata remains accepted", async () => {
  await withMockedFetch(async () => ({ content: validRagJson }), async () => {
    const result = await runRag();
    assert.equal(result.abstained, false);
    assert.match(result.answer, /\[SOURCE 1\]/);
  });
});

test("RAG rejects done_reason length instead of accepting or abstaining on its content", async () => {
  await withMockedFetch(async () => ({
    content: validRagJson,
    metadata: { done: true, done_reason: "length" },
  }), async () => {
    await assert.rejects(runRag(), (error) => {
      assert.equal(error.code, "OLLAMA_OUTPUT_TRUNCATED");
      assert.match(error.message, /truncated/i);
      return true;
    });
  });
});

test("RAG rejects done false when completion metadata marks the response incomplete", async () => {
  await withMockedFetch(async () => ({
    content: validRagJson,
    metadata: { done: false },
  }), async () => {
    await assert.rejects(runRag(), (error) => error.code === "OLLAMA_OUTPUT_TRUNCATED");
  });
});

test("length-limited malformed output is a generation error, not a validation abstention", async () => {
  await withMockedFetch(async () => ({
    content: '{"answer":"partial",',
    metadata: { done: true, done_reason: "length" },
  }), async () => {
    await assert.rejects(runRag(), (error) => error.code === "OLLAMA_OUTPUT_TRUNCATED");
  });
});

test("malformed complete JSON retains the existing structured abstention behavior", async () => {
  await withMockedFetch(async () => ({
    content: "{not valid JSON",
    metadata: { done: true, done_reason: "stop" },
  }), async () => {
    const result = await runRag();
    assert.equal(result.abstained, true);
    assert.equal(result.answer, "I couldn't find this information in the provided document.");
  });
});

test("invalid source labels retain the existing structured abstention behavior", async () => {
  const invalidCitation = JSON.stringify({
    answer: "The claim has a source.",
    claims: [{ text: "The claim has a source.", sourceLabels: ["SOURCE 2"] }],
    abstained: false,
  });

  await withMockedFetch(async () => ({ content: invalidCitation }), async () => {
    const result = await runRag();
    assert.equal(result.abstained, true);
    assert.equal(result.answer, "I couldn't find this information in the provided document.");
  });
});

test("generic generateAnswer request behavior remains unchanged", async () => {
  await withMockedFetch(async () => ({ content: "Generic response" }), async (requests) => {
    const result = await generateAnswer("Generic question", "Generic context");

    assert.equal(result, "Generic response");
    assert.equal(requests.length, 1);
    assert.equal(Object.hasOwn(requests[0].payload, "format"), false);
    assert.equal(requests[0].payload.options.num_ctx, 4096);
    assert.equal(requests[0].payload.options.num_predict, 384);
  });
});
