const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createServer } = require("vite");
const { AxiosError } = require("axios");

const clientRoot = path.resolve(__dirname, "..");
const originalApiBaseUrl = process.env.VITE_API_BASE_URL;

let viteServer;
let api;
let requestInterceptor;
let storedValues;
let removedKeys;
let redirects;

const setStorage = (values = {}) => {
  storedValues = { ...values };
  removedKeys = [];
  globalThis.localStorage = {
    getItem(key) {
      return storedValues[key] ?? null;
    },
    setItem(key, value) {
      storedValues[key] = String(value);
    },
    removeItem(key) {
      removedKeys.push(key);
      delete storedValues[key];
    },
  };
};

const setWindow = (pathname = "/documents") => {
  redirects = [];
  globalThis.window = {
    location: {
      pathname,
      assign(location) {
        redirects.push(location);
      },
    },
  };
};

const setResponseAdapter = (status) => {
  api.defaults.adapter = async (config) => {
    const response = {
      status,
      statusText: "mock",
      headers: {},
      config,
      data: { success: false, message: "mock response" },
    };
    throw new AxiosError("mock request failure", "ERR_TEST", config, {}, response);
  };
};

const setSuccessAdapter = () => {
  api.defaults.adapter = async (config) => ({
    status: 200,
    statusText: "OK",
    headers: {},
    config,
    data: { success: true },
  });
};

const resetRedirectLatch = async () => {
  setSuccessAdapter();
  await api.post("/auth/login", {});
};

const assertRequestRejects = async (request) => {
  await assert.rejects(request);
};

test.before(async () => {
  process.env.VITE_API_BASE_URL = "https://api.example.test/api";
  viteServer = await createServer({
    configFile: path.join(clientRoot, "vite.config.js"),
    root: clientRoot,
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });
  ({ default: api } = await viteServer.ssrLoadModule("/src/services/api.js"));
  requestInterceptor = api.interceptors.request.handlers.find(Boolean).fulfilled;
  setStorage();
  setWindow();
});

test.after(async () => {
  await viteServer?.close();
  if (originalApiBaseUrl === undefined) {
    delete process.env.VITE_API_BASE_URL;
  } else {
    process.env.VITE_API_BASE_URL = originalApiBaseUrl;
  }
  delete globalThis.localStorage;
  delete globalThis.window;
});

test("uses VITE_API_BASE_URL when configured", () => {
  assert.equal(api.defaults.baseURL, "https://api.example.test/api");
});

test("attaches a bearer token when one is stored", async () => {
  setStorage({ token: "test-token" });
  const config = await requestInterceptor({ headers: {} });
  assert.equal(config.headers.Authorization, "Bearer test-token");
});

test("does not add Authorization when no token is stored", async () => {
  setStorage();
  const config = await requestInterceptor({ headers: {} });
  assert.equal(Object.hasOwn(config.headers, "Authorization"), false);
});

test("protected API 401 clears both session values, redirects once, and preserves the Axios error", async () => {
  await resetRedirectLatch();
  setStorage({ token: "expired-token", user: "cached-user" });
  setWindow("/documents");
  setResponseAdapter(401);
  let observedError;
  try {
    await api.get("/documents");
  } catch (error) {
    observedError = error;
  }

  assert.equal(observedError instanceof AxiosError, true);
  assert.deepEqual(removedKeys, ["token", "user"]);
  assert.deepEqual(redirects, ["/login"]);
  assert.deepEqual(storedValues, {});
});

test("concurrent protected 401 responses clear and redirect only once", async () => {
  await resetRedirectLatch();
  setStorage({ token: "expired-token", user: "cached-user" });
  setWindow("/chat");
  setResponseAdapter(401);

  await Promise.all([
    assertRequestRejects(api.get("/documents")),
    assertRequestRejects(api.get("/users/profile")),
  ]);

  assert.deepEqual(removedKeys, ["token", "user"]);
  assert.deepEqual(redirects, ["/login"]);
});

test("login 401 preserves the session and does not redirect", async () => {
  await resetRedirectLatch();
  setStorage({ token: "existing-token", user: "existing-user" });
  setWindow("/login");
  setResponseAdapter(401);

  await assertRequestRejects(api.post("/auth/login", {}));

  assert.deepEqual(removedKeys, []);
  assert.deepEqual(redirects, []);
  assert.equal(storedValues.token, "existing-token");
});

test("registration 401 preserves the session and does not redirect", async () => {
  await resetRedirectLatch();
  setStorage({ token: "existing-token", user: "existing-user" });
  setWindow("/register");
  setResponseAdapter(401);

  await assertRequestRejects(api.post("/auth/register", {}));

  assert.deepEqual(removedKeys, []);
  assert.deepEqual(redirects, []);
  assert.equal(storedValues.token, "existing-token");
});

test("403 does not clear the session or redirect", async () => {
  await resetRedirectLatch();
  setStorage({ token: "valid-token", user: "cached-user" });
  setWindow("/documents");
  setResponseAdapter(403);

  await assertRequestRejects(api.get("/documents"));

  assert.deepEqual(removedKeys, []);
  assert.deepEqual(redirects, []);
});

test("network errors and 5xx responses do not clear the session", async () => {
  await resetRedirectLatch();
  setStorage({ token: "valid-token", user: "cached-user" });
  setWindow("/documents");
  api.defaults.adapter = async () => {
    throw new AxiosError("network failure", "ERR_NETWORK");
  };
  await assertRequestRejects(api.get("/documents"));
  assert.deepEqual(removedKeys, []);
  assert.deepEqual(redirects, []);

  setResponseAdapter(503);
  await assertRequestRejects(api.get("/documents"));
  assert.deepEqual(removedKeys, []);
  assert.deepEqual(redirects, []);
});

test("a 401 while already on login does not navigate into a redirect loop", async () => {
  await resetRedirectLatch();
  setStorage({ token: "expired-token", user: "cached-user" });
  setWindow("/login");
  setResponseAdapter(401);

  await assertRequestRejects(api.get("/documents"));

  assert.deepEqual(removedKeys, ["token", "user"]);
  assert.deepEqual(redirects, []);
});
