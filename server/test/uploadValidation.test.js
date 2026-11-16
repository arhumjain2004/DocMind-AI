const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");

const middlewarePath = path.resolve(
  __dirname,
  "../src/middleware/uploadMiddleware.js"
);
const servicePath = path.resolve(
  __dirname,
  "../src/services/documentService.js"
);
const serverPath = path.resolve(__dirname, "../src/server.js");
const originalLoad = Module._load;

const middlewareState = {};
const fakeMulter = (options) => {
  middlewareState.options = options;
  return {
    single: (fieldName) => {
      middlewareState.fieldName = fieldName;
      return function mockedUploadMiddleware() {};
    },
  };
};
fakeMulter.diskStorage = (options) => {
  middlewareState.storageOptions = options;
  return options;
};

Module._load = function(request, parent, isMain) {
  if (parent && path.resolve(parent.filename) === middlewarePath && request === "multer") {
    return fakeMulter;
  }
  return originalLoad.call(this, request, parent, isMain);
};
delete require.cache[middlewarePath];
require(middlewarePath);
Module._load = originalLoad;

const invokeFileFilter = (file) => new Promise((resolve) => {
  middlewareState.options.fileFilter({}, file, (error, accepted) => {
    resolve({ error, accepted });
  });
});

const parserState = {
  constructedBuffers: [],
  parseError: null,
  destroyed: 0,
};

class MockPDFParse {
  constructor({ data }) {
    parserState.constructedBuffers.push(data);
  }

  async getText() {
    if (parserState.parseError) throw parserState.parseError;
    return {
      text: "Parsed PDF text",
      total: 1,
      pages: [{ num: 1, text: "Parsed PDF text" }],
    };
  }

  async destroy() {
    parserState.destroyed += 1;
  }
}

Module._load = function(request, parent, isMain) {
  if (parent && path.resolve(parent.filename) === servicePath && request === "pdf-parse") {
    return { PDFParse: MockPDFParse };
  }
  return originalLoad.call(this, request, parent, isMain);
};
delete require.cache[servicePath];
const { extractPdfText } = require(servicePath);
Module._load = originalLoad;

const withTemporaryFile = async (buffer, callback) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "docmind-upload-validation-"));
  const filePath = path.join(directory, "test.pdf");
  try {
    await fs.writeFile(filePath, buffer);
    return await callback(filePath);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
};

let uploadErrorHandler;
const serverRegistrations = [];
const fakeApp = {
  use(...args) {
    serverRegistrations.push(args);
  },
  get() {},
  listen() {
    serverRegistrations.push(["listen"]);
  },
};
const fakeExpress = () => fakeApp;
fakeExpress.json = () => function mockedJsonParser() {};

const serverMocks = {
  dotenv: { config() {} },
  express: fakeExpress,
  cors: () => function mockedCors() {},
  "./routes/authRoutes": {},
  "./routes/userRoutes": {},
  "./routes/documentRoutes": {},
  "./config/db": async () => {},
  "./services/qdrantCollectionService": {
    createCollection: async () => {},
  },
};

Module._load = function(request, parent, isMain) {
  if (
    parent &&
    path.resolve(parent.filename) === serverPath &&
    Object.prototype.hasOwnProperty.call(serverMocks, request)
  ) {
    return serverMocks[request];
  }
  return originalLoad.call(this, request, parent, isMain);
};
delete require.cache[serverPath];
require(serverPath);
Module._load = originalLoad;

const findErrorHandler = async () => {
  if (!uploadErrorHandler) {
    await new Promise((resolve) => setImmediate(resolve));
    const registration = serverRegistrations.find(
      (args) => args.length === 1 && typeof args[0] === "function" && args[0].length === 4
    );
    uploadErrorHandler = registration?.[0];
  }
  assert.equal(typeof uploadErrorHandler, "function");
  return uploadErrorHandler;
};

const invokeErrorHandler = async (error, headersSent = false) => {
  const response = {
    headersSent,
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let delegatedError;
  const handler = await findErrorHandler();
  handler(error, {}, response, (nextError) => {
    delegatedError = nextError;
  });
  return { response, delegatedError };
};

test("valid PDF MIME and .pdf extension are accepted", async () => {
  const result = await invokeFileFilter({
    originalname: "document.pdf",
    mimetype: "application/pdf",
  });
  assert.equal(result.error, null);
  assert.equal(result.accepted, true);
});

test("extension matching is case-insensitive", async () => {
  const result = await invokeFileFilter({
    originalname: "document.PDF",
    mimetype: "application/pdf",
  });
  assert.equal(result.error, null);
  assert.equal(result.accepted, true);
});

test("MIME mismatch is rejected before storage", async () => {
  const result = await invokeFileFilter({
    originalname: "document.pdf",
    mimetype: "application/octet-stream",
  });
  assert.equal(result.accepted, undefined);
  assert.equal(result.error.code, "INVALID_FILE_TYPE");
});

test("extension mismatch is rejected before storage", async () => {
  const result = await invokeFileFilter({
    originalname: "document.txt",
    mimetype: "application/pdf",
  });
  assert.equal(result.accepted, undefined);
  assert.equal(result.error.code, "INVALID_FILE_TYPE");
});

test("10 MiB Multer file-size limit and storage destination remain unchanged", () => {
  assert.equal(middlewareState.options.limits.fileSize, 10 * 1024 * 1024);
  let destination;
  middlewareState.storageOptions.destination({}, {}, (_error, value) => {
    destination = value;
  });
  assert.equal(destination, "uploads/");
});

test("invalid signature is rejected before parser construction", async () => {
  parserState.constructedBuffers = [];
  parserState.destroyed = 0;
  parserState.parseError = null;

  await withTemporaryFile(Buffer.from("not a pdf file"), async (filePath) => {
    await assert.rejects(
      extractPdfText(filePath),
      (error) => error.code === "INVALID_PDF_SIGNATURE"
    );
  });

  assert.equal(parserState.constructedBuffers.length, 0);
  assert.equal(parserState.destroyed, 0);
});

test("PDF signature within the first 1024 bytes is accepted", async () => {
  parserState.constructedBuffers = [];
  parserState.destroyed = 0;
  parserState.parseError = null;
  const buffer = Buffer.alloc(1040, 0x20);
  buffer.write("%PDF-", 1000, "ascii");

  await withTemporaryFile(buffer, async (filePath) => {
    const result = await extractPdfText(filePath);
    assert.equal(result.text, "Parsed PDF text");
  });

  assert.equal(parserState.constructedBuffers.length, 1);
  assert.equal(parserState.destroyed, 1);
});

test("PDF signature ending at byte 1024 is accepted", async () => {
  parserState.constructedBuffers = [];
  parserState.destroyed = 0;
  parserState.parseError = null;
  const buffer = Buffer.alloc(1030, 0x20);
  buffer.write("%PDF-", 1019, "ascii");

  await withTemporaryFile(buffer, async (filePath) => {
    await extractPdfText(filePath);
  });

  assert.equal(parserState.constructedBuffers.length, 1);
});

test("PDF signature beginning outside the first 1024 bytes is rejected", async () => {
  parserState.constructedBuffers = [];
  parserState.destroyed = 0;
  parserState.parseError = null;
  const buffer = Buffer.alloc(1040, 0x20);
  buffer.write("%PDF-", 1020, "ascii");

  await withTemporaryFile(buffer, async (filePath) => {
    await assert.rejects(extractPdfText(filePath), { code: "INVALID_PDF_SIGNATURE" });
  });

  assert.equal(parserState.constructedBuffers.length, 0);
});

test("valid signature with malformed PDF is rejected by the parser and destroyed", async () => {
  parserState.constructedBuffers = [];
  parserState.destroyed = 0;
  parserState.parseError = Object.assign(new Error("parser detail"), { code: "INVALID_PDF" });

  await withTemporaryFile(Buffer.from("%PDF-malformed"), async (filePath) => {
    await assert.rejects(extractPdfText(filePath), { code: "INVALID_PDF" });
  });

  assert.equal(parserState.constructedBuffers.length, 1);
  assert.equal(parserState.destroyed, 1);
  parserState.parseError = null;
});

test("Multer file-size error returns safe JSON with HTTP 413", async () => {
  const { response } = await invokeErrorHandler({ code: "LIMIT_FILE_SIZE", path: "private/path.pdf" });
  assert.equal(response.statusCode, 413);
  assert.deepEqual(response.body, {
    success: false,
    message: "File exceeds the 10 MiB upload limit.",
  });
});

test("invalid file type and unexpected upload field return safe JSON 400", async () => {
  const type = await invokeErrorHandler({ code: "INVALID_FILE_TYPE", stack: "secret path" });
  assert.equal(type.response.statusCode, 400);
  assert.deepEqual(type.response.body, {
    success: false,
    message: "Only PDF files are allowed.",
  });

  const field = await invokeErrorHandler({ code: "LIMIT_UNEXPECTED_FILE", filename: "private.pdf" });
  assert.equal(field.response.statusCode, 400);
  assert.deepEqual(field.response.body, {
    success: false,
    message: "Unexpected upload field.",
  });
});

test("unexpected errors return generic JSON without internal details", async () => {
  const { response } = await invokeErrorHandler({
    message: "D:\\private\\secrets\\document.pdf failed with credentials",
    stack: "internal stack",
  });
  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, {
    success: false,
    message: "Internal server error.",
  });
  assert.equal(JSON.stringify(response.body).includes("private"), false);
  assert.equal(JSON.stringify(response.body).includes("credentials"), false);
});

test("errors are delegated when response headers have already been sent", async () => {
  const error = new Error("late error");
  const { response, delegatedError } = await invokeErrorHandler(error, true);
  assert.equal(response.statusCode, null);
  assert.equal(response.body, null);
  assert.equal(delegatedError, error);
});
