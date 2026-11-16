const createChunks = (
  text,
  chunkSize = 1000,
  overlap = 200
) => {
  const chunks = [];

  let start = 0;
  let chunkIndex = 0;

  while (start < text.length) {
    const end = Math.min(
      start + chunkSize,
      text.length
    );

    const chunkText = text
      .slice(start, end)
      .trim();

    if (chunkText) {
      chunks.push({
        chunkIndex,
        text: chunkText,
        characterCount: chunkText.length,
      });

      chunkIndex++;
    }

    if (end === text.length) {
      break;
    }

    start = end - overlap;
  }

  return chunks;
};

const createPageChunks = (
  pages,
  chunkSize = 1000,
  overlap = 200
) => {
  if (!Array.isArray(pages)) {
    throw new Error("PDF pages must be provided as an array");
  }

  const chunks = [];

  for (const page of pages) {
    if (
      !Number.isInteger(page.pageNumber) ||
      page.pageNumber < 1 ||
      typeof page.text !== "string"
    ) {
      throw new Error("Each PDF page must include its number and text");
    }

    const pageChunks = createChunks(page.text, chunkSize, overlap);

    for (const chunk of pageChunks) {
      chunks.push({
        ...chunk,
        chunkIndex: chunks.length,
        pageNumber: page.pageNumber,
      });
    }
  }

  return chunks;
};

module.exports = {
  createChunks,
  createPageChunks,
};
