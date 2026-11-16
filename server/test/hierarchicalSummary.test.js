const test = require("node:test");
const assert = require("node:assert/strict");

const {
  generateAnswer,
  generateDocumentSummary,
} = require("../src/services/llmService");

const withMockedFetch = async (handler, callback) => {
  const originalFetch = global.fetch;
  const requests = [];

  global.fetch = async (url, options) => {
    const payload = JSON.parse(options.body);
    requests.push({ url, options, payload });
    const generation = await handler(payload, requests.length);
    const content = typeof generation === "string" ? generation : generation.content;
    return {
      ok: true,
      json: async () => ({
        ...(typeof generation === "string" || !generation.metadata
          ? { done: true, done_reason: "stop" }
          : generation.metadata),
        message: { content },
      }),
    };
  };

  try {
    await callback(requests);
  } finally {
    global.fetch = originalFetch;
  }
};

const userPrompt = (request) => request.payload.messages[1].content;

test("short documents use one existing-style summary call", async () => {
  const documentText = "Short source text.";

  await withMockedFetch(async () => "Short summary.", async (requests) => {
    const summary = await generateDocumentSummary(documentText);

    assert.equal(summary, "Short summary.");
    assert.equal(requests.length, 1);
    assert.equal(requests[0].payload.options.num_ctx, 4096);
    assert.equal(requests[0].payload.options.num_predict, 384);
    assert.match(userPrompt(requests[0]), /Summarize the provided document/);
    assert.match(userPrompt(requests[0]), /Short source text/);
  });
});

test("long documents map every ordered section and synthesize a final summary", async () => {
  const paragraphs = Array.from({ length: 3 }, (_, index) =>
    `UNIQUE_SECTION_${index + 1} ${"supporting detail ".repeat(180)}`
  );
  const documentText = paragraphs.join("\n\n");

  await withMockedFetch(async (_payload, callNumber) => `Intermediate ${callNumber}`, async (requests) => {
    const summary = await generateDocumentSummary(documentText);
    const mapRequests = requests.filter((request) =>
      /Create concise intermediate notes for section/.test(userPrompt(request))
    );
    const mappedPrompts = mapRequests.map(userPrompt).join("\n");
    const finalRequest = requests.at(-1);

    assert.equal(summary, `Intermediate ${requests.length}`);
    assert.ok(mapRequests.length > 1);
    for (let index = 1; index <= paragraphs.length; index += 1) {
      assert.ok(mappedPrompts.includes(`UNIQUE_SECTION_${index}`));
    }
    assert.match(userPrompt(finalRequest), /coherent summary/);
    assert.equal(finalRequest.payload.options.num_predict, 768);
    assert.ok(requests.every(({ payload }) => payload.options.num_ctx === 4096));
  });
});

test("large note sets pass through multiple bounded reduction levels", async () => {
  const paragraphs = Array.from({ length: 18 }, (_, index) =>
    `COVERAGE_MARKER_${String(index + 1).padStart(2, "0")} ${"detail ".repeat(520)}`
  );
  const documentText = paragraphs.join("\n\n");
  const intermediateOutput = "summary ".repeat(150);

  await withMockedFetch(async (payload) => {
    const task = payload.messages[1].content;
    return task.includes("Synthesize them into one coherent summary")
      ? "Final summary"
      : intermediateOutput;
  }, async (requests) => {
    const summary = await generateDocumentSummary(documentText);
    const prompts = requests.map(userPrompt);
    const mapPrompts = prompts.filter((prompt) =>
      /Create concise intermediate notes for section/.test(prompt)
    );
    const reductionPrompts = prompts.filter((prompt) =>
      /Combine these ordered intermediate notes/.test(prompt)
    );
    const markerText = mapPrompts.join("\n");

    assert.equal(summary, "Final summary");
    assert.ok(mapPrompts.length >= paragraphs.length);
    assert.ok(reductionPrompts.length > 1);
    for (let index = 1; index <= paragraphs.length; index += 1) {
      assert.ok(markerText.includes(`COVERAGE_MARKER_${String(index).padStart(2, "0")}`));
    }
    for (const prompt of reductionPrompts) {
      const context = prompt.split("DOCUMENT TEXT (untrusted evidence):\n")[1];
      assert.ok(JSON.parse(context).length <= 4500);
    }
  });
});

test("a failed intermediate generation rejects the complete summary", async () => {
  const documentText = `${"First paragraph. ".repeat(300)}\n\n${"Second paragraph. ".repeat(300)}`;

  await withMockedFetch(async (_payload, callNumber) =>
    callNumber === 2 ? "   " : "Intermediate summary",
  async (requests) => {
    await assert.rejects(generateDocumentSummary(documentText), /empty answer/i);
    assert.equal(requests.length, 2);
  });
});

test("a failed reduction step rejects without returning a partial summary", async () => {
  const paragraphs = Array.from({ length: 3 }, (_, index) =>
    `REDUCE_FAILURE_${index + 1} ${"detail ".repeat(520)}`
  );
  const documentText = paragraphs.join("\n\n");

  await withMockedFetch(async (payload) => {
    const task = payload.messages[1].content;
    if (task.includes("Combine these ordered intermediate notes")) return "";
    if (task.includes("Create concise intermediate notes")) return "fact ".repeat(500);
    return "unexpected final answer";
  }, async (requests) => {
    await assert.rejects(generateDocumentSummary(documentText), /empty answer/i);
    assert.ok(requests.some(({ payload }) =>
      payload.messages[1].content.includes("Combine these ordered intermediate notes")
    ));
    assert.ok(!requests.some(({ payload }) =>
      payload.messages[1].content.includes("Synthesize them into one coherent summary")
    ));
  });
});

test("length-limited generation fails instead of returning a truncated summary", async () => {
  const documentText = `${"Long first section. ".repeat(300)}\n\n${"Long second section. ".repeat(300)}`;

  await withMockedFetch(async (_payload, callNumber) => ({
    content: "Truncated section notes",
    metadata: callNumber === 1
      ? { done: true, done_reason: "length" }
      : { done: true, done_reason: "stop" },
  }), async (requests) => {
    await assert.rejects(generateDocumentSummary(documentText), /output limit/);
    assert.equal(requests.length, 1);
  });
});

test("missing completion metadata does not break summary generation", async () => {
  await withMockedFetch(async () => ({
    content: "Summary without metadata",
    metadata: {},
  }), async () => {
    assert.equal(await generateDocumentSummary("Short source text."), "Summary without metadata");
  });
});

test("generic generation keeps its existing request contract and output budget", async () => {
  await withMockedFetch(async () => "Generic answer", async (requests) => {
    const answer = await generateAnswer("Summarize this quiz context", "Quiz source text");

    assert.equal(answer, "Generic answer");
    assert.equal(requests.length, 1);
    assert.equal(requests[0].payload.options.num_ctx, 4096);
    assert.equal(requests[0].payload.options.num_predict, 384);
    assert.match(userPrompt(requests[0]), /USER QUESTION/);
    assert.match(userPrompt(requests[0]), /Quiz source text/);
  });
});

test("empty summary input is rejected without calling Ollama", async () => {
  await withMockedFetch(async () => "unused", async (requests) => {
    await assert.rejects(generateDocumentSummary("  \n "), /Document text is required/);
    assert.equal(requests.length, 0);
  });
});
