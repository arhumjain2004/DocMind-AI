const RAG_ABSTENTION = "I couldn't find this information in the provided document.";

const COUNT_WORDS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};

const getRequestedCount = (query) => {
  const numberPattern = `(?:\\d+|${Object.keys(COUNT_WORDS).join("|")})`;
  const countPattern = new RegExp(
    `\\b(${numberPattern})\\s+(?:(?:evaluation|grading|assessment)\\s+)?(?:criteria|criterion|items?|entries|requirements?|areas)\\b`,
    "i"
  );
  const match = query.match(countPattern);

  if (!match) return null;
  if (/^\d+$/.test(match[1])) return Number(match[1]);
  return COUNT_WORDS[match[1].toLowerCase()] ?? null;
};

const isListTableQuestion = (query) =>
  /\b(?:list|table|criteria|criterion|requirements?|items?|entries|areas)\b/i.test(query) &&
  /\b(?:weight(?:age)?s?|percent(?:age)?s?|scores?)\b|%/i.test(query);

const isHeaderLine = (line) => {
  const normalized = line.replace(/[|:]/g, " ").toLowerCase();
  return (
    /\b(?:area|label|criterion|criteria|requirement|item)\b/.test(normalized) &&
    /\b(?:weight|weightage|percentage|percent)\b/.test(normalized)
  );
};

const isDividerLine = (line) =>
  line.includes("-") && /^[\s|:+-]+$/.test(line);

const makeRow = (label, value, source) => {
  const cleanLabel = label.trim();
  const cleanValue = value.trim();
  const numericValue = Number(cleanValue.replace(/\s*%$/, ""));

  if (
    !cleanLabel ||
    /[%\d]/.test(cleanLabel) ||
    !Number.isFinite(numericValue) ||
    numericValue < 0 ||
    numericValue > 100
  ) {
    return { type: "invalid" };
  }

  return {
    type: "row",
    row: {
      label: cleanLabel,
      value: cleanValue,
      text: `${cleanLabel} — ${cleanValue}`,
      sourceLabel: source.label,
      pageNumber: source.result.payload.pageNumber,
      result: source.result,
    },
  };
};

const parseRowLine = (line, source) => {
  if (line.includes("|")) {
    const cells = line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());

    if (cells.length === 2 && isHeaderLine(cells.join(" "))) {
      return { type: "header" };
    }
    if (isDividerLine(line)) return { type: "divider" };

    if (cells.length !== 2) {
      return line.includes("%") ? { type: "invalid" } : { type: "other" };
    }

    if (!cells[1]) return { type: "other" };
    if (!/^(?:100|(?:\d{1,2})(?:\.\d+)?)\s*%$/.test(cells[1])) {
      return cells[1].includes("%") || line.includes("%")
        ? { type: "invalid" }
        : { type: "other" };
    }

    return makeRow(cells[0], cells[1], source);
  }

  const percentCount = (line.match(/%/g) || []).length;
  if (percentCount === 0) return { type: "other" };
  if (percentCount !== 1) return { type: "invalid" };

  const match = line.trim().match(
    /^(?:(?:[-*•]\s+|\d+[.)]\s+))?(.+?)\s+(?:[—–-]\s*)?((?:100|(?:\d{1,2})(?:\.\d+)?)\s*%)$/u
  );
  if (!match) return { type: "invalid" };

  return makeRow(match[1], match[2], source);
};

const parseSource = (source) => {
  const text = source?.result?.payload?.text;
  if (typeof text !== "string" || !text.trim()) {
    return { groups: [], invalid: false, headerCount: 0 };
  }

  const groups = [];
  let currentRows = [];
  let headerCount = 0;
  let tableHeaderActive = false;
  let invalid = false;

  const flushRows = () => {
    if (currentRows.length > 0) {
      groups.push(currentRows);
      currentRows = [];
    }
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      if (!tableHeaderActive) flushRows();
      continue;
    }

    if (isHeaderLine(line)) {
      flushRows();
      headerCount += 1;
      tableHeaderActive = true;
      continue;
    }
    if (isDividerLine(line)) continue;

    const parsed = parseRowLine(line, source);
    if (parsed.type === "row") {
      currentRows.push(parsed.row);
      continue;
    }
    if (parsed.type === "invalid") {
      invalid = true;
      tableHeaderActive = false;
      flushRows();
      continue;
    }

    if (parsed.type === "other" && (tableHeaderActive || currentRows.length > 0)) {
      invalid = true;
      flushRows();
      tableHeaderActive = false;
    }
  }

  flushRows();
  return { groups, invalid, headerCount };
};

const abstain = () => ({
  handled: true,
  abstained: true,
  answer: RAG_ABSTENTION,
  rows: [],
});

const extractDeterministicList = (query, sources) => {
  if (typeof query !== "string" || !isListTableQuestion(query)) {
    return { handled: false };
  }

  if (!Array.isArray(sources) || sources.length === 0) return abstain();

  const requestedCount = getRequestedCount(query);
  const parsedSources = sources.map(parseSource);
  if (parsedSources.some((parsed) => parsed.invalid)) return abstain();

  const headerCount = parsedSources.reduce((sum, parsed) => sum + parsed.headerCount, 0);
  const groups = parsedSources.flatMap((parsed) => parsed.groups);
  if (headerCount > 1 || groups.length !== 1) return abstain();

  const rows = groups[0];
  if (!rows || rows.length === 0) return abstain();
  if (requestedCount !== null && rows.length !== requestedCount) return abstain();

  const seenLabels = new Set();
  for (const row of rows) {
    const normalizedLabel = row.label.toLocaleLowerCase();
    if (seenLabels.has(normalizedLabel)) return abstain();
    seenLabels.add(normalizedLabel);
  }

  return {
    handled: true,
    abstained: false,
    answer: rows
      .map((row) => `${row.text} [${row.sourceLabel}]`)
      .join("\n"),
    rows,
  };
};

module.exports = {
  extractDeterministicList,
  isListTableQuestion,
  getRequestedCount,
};
