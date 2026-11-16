const test = require("node:test");
const assert = require("node:assert/strict");

const {
  extractDeterministicList,
} = require("../src/services/deterministicListExtractionService");

const FALLBACK = "I couldn't find this information in the provided document.";
const QUERY = "What are the five evaluation criteria and their weightages?";

const rows = [
  ["Layout, visual design, and consistency", "25%"],
  ["Responsive design (mobile and desktop)", "20%"],
  ["Code structure and readability", "20%"],
  ["Working navigation, buttons, and form interactions", "20%"],
  ["Submission quality and explanation", "15%"],
];

const markdownTable = (entries = rows) => [
  "| Area | Weight |",
  "| --- | --- |",
  ...entries.map(([label, weight]) => `| ${label} | ${weight} |`),
].join("\n");

const source = (text, options = {}) => ({
  label: options.label || "SOURCE 1",
  result: {
    score: options.score ?? 0.9,
    payload: {
      documentId: options.documentId || "doc-123",
      chunkId: options.chunkId || "chunk-1",
      chunkIndex: options.chunkIndex ?? 0,
      pageNumber: options.pageNumber ?? 2,
      text,
    },
  },
});

test("extracts the exact five criteria, values, source label, and page", () => {
  const result = extractDeterministicList(QUERY, [source(markdownTable())]);

  assert.equal(result.handled, true);
  assert.equal(result.abstained, false);
  assert.equal(result.rows.length, 5);
  assert.deepEqual(
    result.rows.map(({ label, value, sourceLabel, pageNumber }) => ({
      label,
      value,
      sourceLabel,
      pageNumber,
    })),
    rows.map(([label, value]) => ({
      label,
      value,
      sourceLabel: "SOURCE 1",
      pageNumber: 2,
    }))
  );
  assert.match(result.answer, /Layout, visual design, and consistency — 25% \[SOURCE 1\]/);
  assert.match(result.answer, /Working navigation, buttons, and form interactions — 20% \[SOURCE 1\]/);
  assert.match(result.answer, /Submission quality and explanation — 15% \[SOURCE 1\]/);
});

test("abstains when the explicitly requested number of rows is missing", () => {
  const result = extractDeterministicList(QUERY, [source(markdownTable(rows.slice(0, 4)))]);
  assert.equal(result.handled, true);
  assert.equal(result.abstained, true);
  assert.equal(result.answer, FALLBACK);
});

test("abstains for invalid, multiple, or out-of-range percentages", () => {
  const ambiguous = markdownTable([
    ...rows.slice(0, 3),
    ["Working navigation, buttons, and form interactions", "20% / 15%"],
    rows[4],
  ]);
  const outOfRange = markdownTable([
    ...rows.slice(0, 4),
    ["Submission quality and explanation", "115%"],
  ]);

  assert.equal(extractDeterministicList(QUERY, [source(ambiguous)]).answer, FALLBACK);
  assert.equal(extractDeterministicList(QUERY, [source(outOfRange)]).answer, FALLBACK);
});

test("abstains when a requested list is split across retrieved chunks", () => {
  const firstChunk = source(markdownTable(rows.slice(0, 4)), {
    label: "SOURCE 1",
    chunkIndex: 3,
  });
  const secondChunk = source(`| ${rows[4][0]} | ${rows[4][1]} |`, {
    label: "SOURCE 2",
    chunkIndex: 4,
  });

  const result = extractDeterministicList(QUERY, [firstChunk, secondChunk]);
  assert.equal(result.handled, true);
  assert.equal(result.abstained, true);
  assert.equal(result.answer, FALLBACK);
});

test("abstains rather than merging multiple matching tables", () => {
  const twoTables = `${markdownTable()}\n\n${markdownTable()}`;
  const result = extractDeterministicList(QUERY, [source(twoTables)]);
  assert.equal(result.handled, true);
  assert.equal(result.abstained, true);
  assert.equal(result.answer, FALLBACK);
});

test("abstains on duplicate labels with conflicting values", () => {
  const conflicting = markdownTable([
    ...rows,
    ["Layout, visual design, and consistency", "15%"],
  ]);
  const result = extractDeterministicList(QUERY, [source(conflicting)]);
  assert.equal(result.abstained, true);
});

test("leaves ordinary RAG questions unhandled", () => {
  assert.deepEqual(
    extractDeterministicList("What is the purpose of this project?", [source(markdownTable())]),
    { handled: false }
  );
});
