const MAX_CONTEXT_CHARS = 6000;
const CONTEXT_SEPARATOR = "\n-------------------------\n";

const buildContextWithSources = (results) => {
  if (!results || results.length === 0) {
    return { context: "", sources: [] };
  }

  const sections = [];
  const includedSources = [];
  let contextLength = 0;

  for (let index = 0; index < results.length; index += 1) {
    const payload = results[index].payload;
    const header = `
SOURCE ${index + 1}
Document ID: ${payload.documentId}
Chunk: ${payload.chunkIndex}
Page: ${payload.pageNumber}

`;
    const separator = sections.length > 0 ? CONTEXT_SEPARATOR : "";
    const remaining = MAX_CONTEXT_CHARS - contextLength - separator.length;

    // Keep source labels and metadata intact; truncate only the evidence text.
    if (remaining <= header.length) {
      break;
    }

    const text = typeof payload.text === "string" ? payload.text : "";
    const section = `${header}${text.slice(0, remaining - header.length)}`;
    sections.push(section);
    includedSources.push({
      label: `SOURCE ${index + 1}`,
      result: results[index],
    });
    contextLength += separator.length + section.length;

    if (section.length < header.length + text.length) {
      break;
    }
  }

  return {
    context: sections.join(CONTEXT_SEPARATOR),
    sources: includedSources,
  };
};

const buildContext = (results) => {
  return buildContextWithSources(results).context;
};

module.exports = {
  buildContext,
  buildContextWithSources,
};
