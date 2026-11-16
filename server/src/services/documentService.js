const fs = require("fs");
const { PDFParse } = require("pdf-parse");

const extractPdfText = async (filePath) => {
  let parser;

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const pdfSignature = Buffer.from("%PDF-");
    const signatureWindow = fileBuffer.subarray(0, 1024);

    if (signatureWindow.indexOf(pdfSignature) === -1) {
      const error = new Error("Invalid PDF signature");
      error.code = "INVALID_PDF_SIGNATURE";
      throw error;
    }

    parser = new PDFParse({
      data: fileBuffer,
    });

    const result = await parser.getText();

    return {
      text: result.text,
      pageCount: result.total,
      pages: result.pages.map((page) => ({
        pageNumber: page.num,
        text: page.text,
      })),
    };
  } finally {
    if (parser) {
      await parser.destroy();
    }
  }
};

module.exports = {
  extractPdfText,
};
