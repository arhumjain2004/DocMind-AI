const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");
const cors = require("cors");

const serverPath = path.resolve(__dirname, "../src/server.js");
const originalLoad = Module._load;

const loadCorsMiddleware = (clientOrigin) => {
  const previousClientOrigin = process.env.CLIENT_ORIGIN;
  if (clientOrigin === undefined) {
    delete process.env.CLIENT_ORIGIN;
  } else {
    process.env.CLIENT_ORIGIN = clientOrigin;
  }

  const state = { middleware: null, options: null };
  const app = {
    use(middleware) {
      if (!state.middleware) state.middleware = middleware;
    },
    get() {},
    listen() {},
  };
  const express = () => app;
  express.json = () => function jsonMiddleware() {};

  Module._load = function(request, parent, isMain) {
    if (parent && path.resolve(parent.filename) === serverPath) {
      if (request === "dotenv") return { config() {} };
      if (request === "express") return express;
      if (request === "cors") {
        return (options) => {
          state.options = options;
          return cors(options);
        };
      }
      if (request === "./routes/authRoutes" ||
          request === "./routes/userRoutes" ||
          request === "./routes/documentRoutes") return {};
      if (request === "./config/db") return async () => {};
      if (request === "./services/qdrantCollectionService") {
        return { createCollection: async () => {} };
      }
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  delete require.cache[serverPath];
  try {
    require(serverPath);
  } finally {
    Module._load = originalLoad;
    delete require.cache[serverPath];
    if (previousClientOrigin === undefined) {
      delete process.env.CLIENT_ORIGIN;
    } else {
      process.env.CLIENT_ORIGIN = previousClientOrigin;
    }
  }

  return state;
};

const invokeCors = (middleware, origin) => {
  const headers = {};
  let nextCalled = false;
  middleware(
    { headers: { origin }, method: "GET" },
    {
      setHeader(name, value) {
        headers[name.toLowerCase()] = value;
      },
      getHeader(name) {
        return headers[name.toLowerCase()];
      },
    },
    (error) => {
      assert.equal(error, undefined);
      nextCalled = true;
    }
  );
  return { headers, nextCalled };
};

test("CORS accepts the configured CLIENT_ORIGIN", () => {
  const state = loadCorsMiddleware("https://app.example.test");
  assert.equal(state.options.origin, "https://app.example.test");

  const result = invokeCors(state.middleware, "https://app.example.test");
  assert.equal(result.headers["access-control-allow-origin"], "https://app.example.test");
  assert.equal(result.nextCalled, true);
});

test("CORS omits access for an unconfigured browser origin", () => {
  const state = loadCorsMiddleware("https://app.example.test");
  const result = invokeCors(state.middleware, "https://other.example.test");

  // The cors package returns the configured origin; the browser rejects this
  // response for the different requesting origin.
  assert.equal(result.headers["access-control-allow-origin"], "https://app.example.test");
  assert.notEqual(
    result.headers["access-control-allow-origin"],
    "https://other.example.test"
  );
  assert.equal(result.nextCalled, true);
});

test("CORS keeps the localhost development fallback", () => {
  const state = loadCorsMiddleware(undefined);
  assert.equal(state.options.origin, "http://localhost:5173");
});
