const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

const {
  generateAnswer,
  generateQuizContent,
  generateFlashcardContent,
} = require("../src/services/llmService");

const withMockedFetch = async (handler, callback) => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options) => {
    const payload = JSON.parse(options.body);
    requests.push({ url, options, payload });
    const result = await handler(payload, requests.length);
    const generated = typeof result === "string" ? { content: result } : result;
    return {
      ok: true,
      json: async () => ({
        ...(generated.metadata || { done: true, done_reason: "stop" }),
        message: { content: generated.content },
      }),
    };
  };

  try {
    await callback(requests);
  } finally {
    global.fetch = originalFetch;
  }
};

const finalQuiz = (count = 5, overrides = {}) => JSON.stringify({
  title: "Generated Quiz",
  questions: Array.from({ length: count }, (_, index) => ({
    question: `Question ${index + 1}?`,
    options: ["Correct", "Second", "Third", "Fourth"],
    correctAnswerText: "Correct",
    explanation: "The source states this fact.",
    ...overrides,
  })),
});

const finalFlashcards = (count = 10, overrides = {}) => JSON.stringify({
  title: "Generated Cards",
  flashcards: Array.from({ length: count }, (_, index) => ({
    question: `Question ${index + 1}?`,
    answer: `Answer ${index + 1}.`,
    ...overrides,
  })),
});

const parseEvidence = (userMessage) => {
  const prefix = "UNTRUSTED DOCUMENT EVIDENCE (JSON string):\n";
  const start = userMessage.indexOf(prefix);
  assert.notEqual(start, -1);
  const jsonStart = start + prefix.length;
  const suffix = "\n\nReturn valid JSON only. Do not use Markdown or code fences.";
  const end = userMessage.lastIndexOf(suffix);
  assert.ok(end >= jsonStart);
  return JSON.parse(userMessage.slice(jsonStart, end));
};

const makeStudyDocument = (sectionCount) => Array.from(
  { length: sectionCount },
  (_, index) => `LATE_FACT_S${String(index + 1).padStart(4, "0")} ${"supporting detail ".repeat(170)}`
).join("\n\n");

test("short Quiz and Flashcards each use one JSON-mode call with original text", async () => {
  const text = "  Original extracted source text.  ";
  const quizPrompt = "Existing Quiz prompt: exactly five questions; return JSON.";
  const cardsPrompt = "Existing Flashcards prompt: exactly ten cards; return JSON.";

  await withMockedFetch(async (payload) => {
    const user = payload.messages[1].content;
    return user.includes("Existing Quiz prompt") ? finalQuiz() : finalFlashcards();
  }, async (requests) => {
    const quiz = await generateQuizContent(quizPrompt, text);
    const cards = await generateFlashcardContent(cardsPrompt, text);

    assert.equal(JSON.parse(quiz).questions.length, 5);
    assert.equal(JSON.parse(cards).flashcards.length, 10);
    assert.equal(requests.length, 2);
    assert.deepEqual(requests.map(({ payload }) => payload.format), ["json", "json"]);
    assert.deepEqual(requests.map(({ payload }) => payload.options.num_predict), [1024, 768]);
    for (const { payload } of requests) {
      assert.equal(payload.options.num_ctx, 4096);
      assert.match(payload.messages[1].content, /Original extracted source text/);
      assert.match(payload.messages[1].content, /Return valid JSON only/);
    }
    assert.match(requests[0].payload.messages[1].content, /Existing Quiz prompt/);
    assert.match(requests[1].payload.messages[1].content, /Existing Flashcards prompt/);
  });
});

test("long Quiz maps every ordered section, retains IDs through multiple reductions, and passes later facts to final generation", async () => {
  const documentText = makeStudyDocument(18);
  const mappedIds = [];
  const reductionInputs = [];
  let reductionLevel = 0;
  let finalCandidateRecords;

  await withMockedFetch(async (payload) => {
    const user = payload.messages[1].content;
    if (user.includes("Extract concise, source-grounded candidate")) {
      const sectionId = user.match(/sectionId "(S\d+)"/)[1];
      mappedIds.push(sectionId);
      return JSON.stringify({
        sections: [{ sectionId, facts: [`MAP_${sectionId}_${"x".repeat(650)}`] }],
      });
    }

    if (user.includes("Merge the supplied candidate facts")) {
      const input = JSON.parse(parseEvidence(user));
      const inputIds = input.sections.map(({ sectionId }) => sectionId);
      reductionInputs.push(inputIds);
      const hasFirstLevelFacts = input.sections.some(({ facts }) => facts.some((fact) => fact.includes("_x")));
      reductionLevel = Math.max(reductionLevel, hasFirstLevelFacts ? 1 : 2);
      return JSON.stringify({
        sections: input.sections.map(({ sectionId }) => ({
          sectionId,
          facts: [hasFirstLevelFacts
            ? `LEVEL1_${sectionId}_${"y".repeat(250)}`
            : `LATE_FACT_${sectionId}`],
        })),
      });
    }

    const candidateText = parseEvidence(user);
    finalCandidateRecords = JSON.parse(candidateText).sections;
    return finalQuiz();
  }, async (requests) => {
    const quiz = await generateQuizContent(
      "Generate exactly 5 multiple-choice questions with four options and explanations. Return JSON.",
      documentText
    );

    assert.equal(JSON.parse(quiz).questions.length, 5);
    assert.deepEqual(
      mappedIds,
      Array.from({ length: 18 }, (_, index) => `S${String(index + 1).padStart(4, "0")}`)
    );
    assert.ok(reductionInputs.length > 1);
    assert.ok(reductionLevel >= 2);
    assert.deepEqual(
      finalCandidateRecords.map(({ sectionId }) => sectionId),
      mappedIds
    );
    assert.ok(finalCandidateRecords.at(-1).facts[0].startsWith("LATE_FACT_"));
    assert.ok(requests.every(({ payload }) => payload.format === "json"));
    assert.ok(requests.every(({ payload }) => payload.options.num_ctx === 4096));
    assert.ok(requests.slice(0, mappedIds.length).every(({ payload }) => payload.options.num_predict === 384));
  });
});

test("long Flashcards map facts from later sections before final generation", async () => {
  const documentText = makeStudyDocument(4);
  const mappedIds = [];
  let finalIds = [];

  await withMockedFetch(async (payload) => {
    const user = payload.messages[1].content;
    if (user.includes("Extract concise, source-grounded candidate")) {
      const sectionId = user.match(/sectionId "(S\d+)"/)[1];
      mappedIds.push(sectionId);
      return JSON.stringify({ sections: [{ sectionId, facts: [`Flash fact ${sectionId}`] }] });
    }
    finalIds = JSON.parse(parseEvidence(user)).sections.map(({ sectionId }) => sectionId);
    return finalFlashcards();
  }, async () => {
    const cards = await generateFlashcardContent(
      "Generate exactly 10 useful question and answer flashcards. Return JSON.",
      documentText
    );
    assert.equal(JSON.parse(cards).flashcards.length, 10);
    assert.deepEqual(finalIds, mappedIds);
    assert.ok(finalIds.length > 1);
  });
});

test("missing completion metadata is tolerated for dedicated output", async () => {
  await withMockedFetch(async () => ({ content: finalQuiz(), metadata: {} }), async () => {
    const result = await generateQuizContent("Return five quiz items as JSON.", "Short source.");
    assert.equal(JSON.parse(result).questions.length, 5);
  });
});

test("missing section IDs in map or reduction output fail without final output", async (t) => {
  await t.test("map output", async () => {
    await withMockedFetch(async (payload) => {
      if (payload.messages[1].content.includes("Extract concise, source-grounded candidate")) {
        return JSON.stringify({ sections: [{ sectionId: "S9999", facts: ["unsupported id"] }] });
      }
      return finalQuiz();
    }, async (requests) => {
      await assert.rejects(
        generateQuizContent("Generate five quiz questions in JSON.", makeStudyDocument(3)),
        /section/i
      );
      assert.equal(requests.length, 1);
    });
  });

  await t.test("reduction output", async () => {
    await withMockedFetch(async (payload) => {
      const user = payload.messages[1].content;
      if (user.includes("Extract concise, source-grounded candidate")) {
        const sectionId = user.match(/sectionId "(S\d+)"/)[1];
        return JSON.stringify({ sections: [{ sectionId, facts: [`Fact ${sectionId} ${"x".repeat(900)}`] }] });
      }
      if (user.includes("Merge the supplied candidate facts")) {
        return JSON.stringify({ sections: [{ sectionId: "S9999", facts: ["lost section"] }] });
      }
      return finalQuiz();
    }, async (requests) => {
      await assert.rejects(
        generateQuizContent("Generate five quiz questions in JSON.", makeStudyDocument(4)),
        /invalid structure|section/i
      );
      assert.ok(requests.some(({ payload }) => payload.messages[1].content.includes("Merge the supplied candidate facts")));
      assert.ok(!requests.some(({ payload }) => payload.messages[1].content.includes("Consider candidates from every sectionId")));
    });
  });

  await t.test("reduction cannot retain IDs while discarding all of a section's facts", async () => {
    await withMockedFetch(async (payload) => {
      const user = payload.messages[1].content;
      if (user.includes("Extract concise, source-grounded candidate")) {
        const sectionId = user.match(/sectionId "(S\d+)"/)[1];
        return JSON.stringify({ sections: [{ sectionId, facts: [`Supported fact ${"x".repeat(650)}`] }] });
      }
      if (user.includes("Merge the supplied candidate facts")) {
        const records = JSON.parse(parseEvidence(user)).sections;
        return JSON.stringify({ sections: records.map(({ sectionId }) => ({ sectionId, facts: [] })) });
      }
      return finalQuiz();
    }, async (requests) => {
      await assert.rejects(
        generateQuizContent("Generate five quiz questions in JSON.", makeStudyDocument(10)),
        /omitted a section's facts/
      );
      assert.ok(!requests.some(({ payload }) => payload.messages[1].content.includes("Consider candidates from every sectionId")));
    });
  });
});

test("map and reduction generation failures do not reach final generation", async (t) => {
  await t.test("map failure", async () => {
    await withMockedFetch(async (_payload, callNumber) => callNumber === 2
      ? { content: "partial", metadata: { done: true, done_reason: "length" } }
      : "{\"sections\":[{\"sectionId\":\"S0001\",\"facts\":[\"fact\"]}]}",
    async (requests) => {
      await assert.rejects(
        generateQuizContent("Generate five quiz questions in JSON.", makeStudyDocument(5)),
        /output limit/
      );
      assert.equal(requests.length, 2);
    });
  });

  await t.test("reduction failure", async () => {
    await withMockedFetch(async (payload) => {
      const user = payload.messages[1].content;
      if (user.includes("Extract concise, source-grounded candidate")) {
        const sectionId = user.match(/sectionId "(S\d+)"/)[1];
        return JSON.stringify({ sections: [{ sectionId, facts: [`${"fact ".repeat(500)}`] }] });
      }
      if (user.includes("Merge the supplied candidate facts")) {
        return { content: "truncated", metadata: { done: true, done_reason: "length" } };
      }
      return finalQuiz();
    }, async (requests) => {
      await assert.rejects(
        generateQuizContent("Generate five quiz questions in JSON.", makeStudyDocument(4)),
        /output limit/
      );
      assert.ok(requests.some(({ payload }) => payload.messages[1].content.includes("Merge the supplied candidate facts")));
      assert.ok(!requests.some(({ payload }) => payload.messages[1].content.includes("Consider candidates from every sectionId")));
    });
  });
});

test("reduction stops after the configured four levels instead of returning partial output", async () => {
  const documentText = makeStudyDocument(20);
  let reductionCalls = 0;

  await withMockedFetch(async (payload) => {
    const user = payload.messages[1].content;
    if (user.includes("Extract concise, source-grounded candidate")) {
      const sectionId = user.match(/sectionId "(S\d+)"/)[1];
      return JSON.stringify({ sections: [{ sectionId, facts: [`${"X".repeat(1500)}`] }] });
    }
    if (user.includes("Merge the supplied candidate facts")) {
      reductionCalls += 1;
      const sections = JSON.parse(parseEvidence(user)).sections;
      return JSON.stringify({
        sections: sections.map(({ sectionId, facts }) => {
          const value = facts[0];
          const nextSize = value.startsWith("X") ? 1000
            : value.startsWith("Y") ? 700
              : value.startsWith("Z") ? 500
                : value.startsWith("W") ? 400
                  : 300;
          const prefix = value.startsWith("X") ? "Y"
            : value.startsWith("Y") ? "Z"
              : value.startsWith("Z") ? "W"
                : value.startsWith("W") ? "V"
                  : "U";
          return { sectionId, facts: [prefix.repeat(nextSize)] };
        }),
      });
    }
    return finalQuiz();
  }, async (requests) => {
    await assert.rejects(
      generateQuizContent("Generate five quiz questions in JSON.", documentText),
      /could not be reduced/
    );
    assert.ok(reductionCalls > 4);
    assert.ok(!requests.some(({ payload }) => payload.messages[1].content.includes("Consider candidates from every sectionId")));
  });
});

test("generic generateAnswer remains unchanged and does not enable JSON mode", async () => {
  await withMockedFetch(async () => "generic response", async (requests) => {
    const answer = await generateAnswer("Existing generic prompt", "Generic context");
    assert.equal(answer, "generic response");
    assert.equal(requests.length, 1);
    assert.equal(Object.hasOwn(requests[0].payload, "format"), false);
    assert.equal(requests[0].payload.options.num_ctx, 4096);
    assert.equal(requests[0].payload.options.num_predict, 384);
  });
});

test("dedicated helpers reject empty, malformed, length-limited, and wrong-count final output", async (t) => {
  await t.test("empty", async () => {
    await withMockedFetch(async () => "  ", async () => {
      await assert.rejects(generateQuizContent("Prompt", "Document text"), /empty answer/i);
    });
  });

  await t.test("malformed JSON", async () => {
    await withMockedFetch(async () => "{not json", async () => {
      await assert.rejects(generateFlashcardContent("Prompt", "Document text"), /malformed JSON/i);
    });
  });

  await t.test("length limited", async () => {
    await withMockedFetch(async () => ({
      content: finalQuiz(),
      metadata: { done: true, done_reason: "length" },
    }), async () => {
      await assert.rejects(generateQuizContent("Prompt", "Document text"), /output limit/i);
    });
  });

  await t.test("wrong item counts", async () => {
    await withMockedFetch(async () => finalQuiz(4), async () => {
      await assert.rejects(generateQuizContent("Prompt", "Document text"), /exactly 5/);
    });
    await withMockedFetch(async () => finalFlashcards(9), async () => {
      await assert.rejects(generateFlashcardContent("Prompt", "Document text"), /exactly 10/);
    });
  });

  await t.test("invalid JSON root structure", async () => {
    await withMockedFetch(async () => JSON.stringify([]), async () => {
      await assert.rejects(generateFlashcardContent("Prompt", "Document text"), /invalid JSON structure/i);
    });
  });
});

test("controller validators retain response contracts and ownership/readiness checks", async (t) => {
  const controllerPath = path.resolve(__dirname, "../src/controllers/documentController.js");
  const originalLoad = Module._load;
  const state = {
    document: { _id: "doc-1", title: "Sample", extractedText: "Owned ready text" },
    query: null,
    quiz: finalQuiz(),
    flashcards: finalFlashcards(),
    quizCalls: 0,
    flashcardCalls: 0,
    quizError: false,
    flashcardError: false,
  };
  const serviceMocks = {
    generateAnswer: async () => "generic",
    generateDocumentSummary: async () => "summary",
    generateQuizContent: async () => {
      state.quizCalls += 1;
      if (state.quizError) throw new Error("failed stage");
      return state.quiz;
    },
    generateFlashcardContent: async () => {
      state.flashcardCalls += 1;
      if (state.flashcardError) throw new Error("failed stage");
      return state.flashcards;
    },
    generateRagAnswer: async () => ({ answer: "answer", claims: [], abstained: false }),
  };
  const mockedDependencies = {
    "fs/promises": {},
    "../models/Document": { findOne: async (query) => { state.query = query; return state.document; } },
    "../models/Chunk": {},
    "../services/qdrantService": {},
    "../services/llmService": serviceMocks,
    "../services/ragService": {},
    "../services/deterministicListExtractionService": {},
    "../services/searchService": {},
    "../services/vectorService": {},
    "../services/qdrantCollectionService": {},
    "../services/embeddingService": {},
    "../utils/textUtils": {},
    "../services/chunkService": {},
    "../services/documentService": {},
  };

  Module._load = function(request, parent, isMain) {
    if (parent && path.resolve(parent.filename) === controllerPath && Object.hasOwn(mockedDependencies, request)) {
      return mockedDependencies[request];
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  delete require.cache[controllerPath];
  const { generateDocumentQuiz, generateDocumentFlashcards } = require(controllerPath);
  Module._load = originalLoad;
  delete require.cache[controllerPath];
  const originalConsoleError = console.error;
  console.error = () => {};

  const invoke = async (handler) => {
    const response = {
      statusCode: null,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await handler({ body: { documentId: "doc-1" }, userId: "user-1" }, response);
    return response;
  };

  try {
    await t.test("successful Quiz and Flashcards preserve API response shapes", async () => {
      state.quizCalls = 0;
      state.flashcardCalls = 0;
      const quizResponse = await invoke(generateDocumentQuiz);
      const flashcardResponse = await invoke(generateDocumentFlashcards);

      assert.equal(quizResponse.statusCode, 200);
      assert.deepEqual(Object.keys(quizResponse.body).sort(), ["document", "message", "quiz", "success"]);
      assert.equal(quizResponse.body.quiz.questions.length, 5);
      assert.equal(flashcardResponse.statusCode, 200);
      assert.deepEqual(Object.keys(flashcardResponse.body).sort(), ["document", "flashcards", "message", "success"]);
      assert.equal(flashcardResponse.body.flashcards.cards.length, 10);
      assert.deepEqual(state.query, { _id: "doc-1", userId: "user-1", status: "ready" });
      assert.equal(state.quizCalls, 1);
      assert.equal(state.flashcardCalls, 1);
    });

    await t.test("helper failure returns the existing generic error without partial success", async () => {
      state.quizError = true;
      const response = await invoke(generateDocumentQuiz);
      assert.equal(response.statusCode, 500);
      assert.deepEqual(response.body, { success: false, message: "Failed to generate quiz. Please try again." });
      state.quizError = false;

      state.flashcardError = true;
      const flashcardResponse = await invoke(generateDocumentFlashcards);
      assert.equal(flashcardResponse.statusCode, 500);
      assert.deepEqual(flashcardResponse.body, { success: false, message: "Failed to generate flashcards. Please try again." });
      state.flashcardError = false;
    });

    await t.test("Quiz validation rejects duplicate options, unmatched answers, and missing explanations", async () => {
      const valid = JSON.parse(finalQuiz());
      state.quiz = JSON.stringify({ ...valid, questions: valid.questions.map((question, index) => ({
        ...question,
        ...(index === 0 ? { options: ["Same", "Same", "Third", "Fourth"] } : {}),
      })) });
      assert.equal((await invoke(generateDocumentQuiz)).statusCode, 500);

      state.quiz = JSON.stringify({ ...valid, questions: valid.questions.map((question, index) => ({
        ...question,
        ...(index === 0 ? { options: ["Correct", "Second", "Third"] } : {}),
      })) });
      assert.equal((await invoke(generateDocumentQuiz)).statusCode, 500);

      state.quiz = JSON.stringify({ ...valid, questions: valid.questions.map((question, index) => ({
        ...question,
        ...(index === 0 ? { question: " " } : {}),
      })) });
      assert.equal((await invoke(generateDocumentQuiz)).statusCode, 500);

      state.quiz = JSON.stringify({ ...valid, questions: valid.questions.map((question, index) => ({
        ...question,
        ...(index === 0 ? { options: ["Correct", " ", "Third", "Fourth"] } : {}),
      })) });
      assert.equal((await invoke(generateDocumentQuiz)).statusCode, 500);

      state.quiz = JSON.stringify({ ...valid, questions: valid.questions.map((question, index) => ({
        ...question,
        ...(index === 0 ? { correctAnswerText: "Unavailable" } : {}),
      })) });
      assert.equal((await invoke(generateDocumentQuiz)).statusCode, 500);

      state.quiz = JSON.stringify({ ...valid, questions: valid.questions.map((question, index) => ({
        ...question,
        ...(index === 0 ? { explanation: " " } : {}),
      })) });
      assert.equal((await invoke(generateDocumentQuiz)).statusCode, 500);
    });

    await t.test("Flashcard validation rejects missing questions or answers", async () => {
      const valid = JSON.parse(finalFlashcards());
      state.flashcards = JSON.stringify({ ...valid, flashcards: valid.flashcards.map((card, index) => ({
        ...card,
        ...(index === 0 ? { question: " " } : {}),
      })) });
      assert.equal((await invoke(generateDocumentFlashcards)).statusCode, 500);

      state.flashcards = JSON.stringify({ ...valid, flashcards: valid.flashcards.map((card, index) => ({
        ...card,
        ...(index === 0 ? { answer: " " } : {}),
      })) });
      assert.equal((await invoke(generateDocumentFlashcards)).statusCode, 500);
    });

    await t.test("not-ready or unowned document fails before generation", async () => {
      state.document = null;
      state.quizCalls = 0;
      state.flashcardCalls = 0;
      assert.equal((await invoke(generateDocumentQuiz)).statusCode, 404);
      assert.equal((await invoke(generateDocumentFlashcards)).statusCode, 404);
      assert.equal(state.quizCalls, 0);
      assert.equal(state.flashcardCalls, 0);
    });
  } finally {
    console.error = originalConsoleError;
    state.document = { _id: "doc-1", title: "Sample", extractedText: "Owned ready text" };
  }
});
