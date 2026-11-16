const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const jwt = require("jsonwebtoken");

const TEST_SECRET = "auth-flow-test-secret-only";
const middlewarePath = path.resolve(__dirname, "../src/middleware/authMiddleware.js");
const controllerPath = path.resolve(__dirname, "../src/controllers/authController.js");
const userRoutesPath = path.resolve(__dirname, "../src/routes/userRoutes.js");
const originalLoad = Module._load;
const previousJwtSecret = process.env.JWT_SECRET;

process.env.JWT_SECRET = TEST_SECRET;

const middleware = require(middlewarePath);

const state = {};
const resetState = () => {
  state.findOneResult = null;
  state.createdUser = { _id: "user-created", name: "Test User", email: "test@example.test" };
  state.findOneCalls = [];
  state.createCalls = [];
  state.hashCalls = [];
  state.compareCalls = [];
  state.compareResult = false;
  state.hashedPassword = "mock-bcrypt-hash";
};
resetState();

const userModelMock = {
  async findOne(query) {
    state.findOneCalls.push(query);
    return state.findOneResult;
  },
  async create(userData) {
    state.createCalls.push(userData);
    return state.createdUser;
  },
};

const bcryptMock = {
  async hash(password, rounds) {
    state.hashCalls.push({ password, rounds });
    return state.hashedPassword;
  },
  async compare(password, hash) {
    state.compareCalls.push({ password, hash });
    return state.compareResult;
  },
};

delete require.cache[controllerPath];
Module._load = function(request, parent, isMain) {
  if (parent && path.resolve(parent.filename) === controllerPath) {
    if (request === "bcryptjs") return bcryptMock;
    if (request === "../models/User") return userModelMock;
  }
  return originalLoad.call(this, request, parent, isMain);
};
let authController;
try {
  authController = require(controllerPath);
} finally {
  Module._load = originalLoad;
}

const makeResponse = () => ({
  statusCode: 200,
  body: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const tokenFor = (userId = "user-valid", options = {}) =>
  jwt.sign({ userId }, TEST_SECRET, options);

const runMiddleware = (authorization) => {
  const req = { headers: {} };
  if (authorization !== undefined) req.headers.authorization = authorization;
  const res = makeResponse();
  let nextCalled = false;
  middleware(req, res, () => {
    nextCalled = true;
  });
  return { req, res, nextCalled };
};

const withSuppressedVerificationLogs = (callback) => {
  const originalError = console.error;
  console.error = () => {};
  try {
    return callback();
  } finally {
    console.error = originalError;
  }
};

const loadProfileRoute = () => {
  const routes = {};
  const router = {
    get(routePath, ...handlers) {
      routes[routePath] = handlers;
      return this;
    },
  };
  const expressMock = { Router: () => router };

  delete require.cache[userRoutesPath];
  Module._load = function(request, parent, isMain) {
    if (parent && path.resolve(parent.filename) === userRoutesPath && request === "express") {
      return expressMock;
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    require(userRoutesPath);
  } finally {
    Module._load = originalLoad;
    delete require.cache[userRoutesPath];
  }

  return routes["/profile"];
};

test.after(() => {
  if (previousJwtSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = previousJwtSecret;
  }
});

test("middleware rejects a missing Authorization header", () => {
  const { res, nextCalled } = runMiddleware();
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, {
    success: false,
    message: "Not authorized. Token missing.",
  });
  assert.equal(nextCalled, false);
});

test("middleware rejects malformed Bearer headers", () => {
  for (const header of ["Bearer", "Basic some-token", "Bearer "]) {
    const { res, nextCalled } = withSuppressedVerificationLogs(() => runMiddleware(header));
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.success, false);
    assert.equal(nextCalled, false);
  }
});

test("middleware rejects invalid and expired JWTs without exposing token or secret", () => {
  const invalidToken = "invalid-test-jwt-content";
  const expiredToken = tokenFor("user-expired", { expiresIn: "-1s" });

  for (const token of [invalidToken, expiredToken]) {
    const { res, nextCalled } = withSuppressedVerificationLogs(() =>
      runMiddleware(`Bearer ${token}`)
    );
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, {
      success: false,
      message: "Invalid or expired token",
    });
    assert.equal(nextCalled, false);
    assert.equal(JSON.stringify(res.body).includes(token), false);
    assert.equal(JSON.stringify(res.body).includes(TEST_SECRET), false);
  }
});

test("middleware accepts a valid JWT and sets req.userId", () => {
  const { req, res, nextCalled } = runMiddleware(`Bearer ${tokenFor("user-123")}`);
  assert.equal(nextCalled, true);
  assert.equal(req.userId, "user-123");
  assert.equal(res.body, undefined);
});

test("login returns the existing success response and excludes password hashes", async () => {
  resetState();
  state.findOneResult = {
    _id: "user-login",
    name: "Login User",
    email: "login@example.test",
    password: "stored-hash-secret",
  };
  state.compareResult = true;

  const res = makeResponse();
  await authController.login(
    { body: { email: "login@example.test", password: "correct-password" } },
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, "Login successful");
  assert.deepEqual(Object.keys(res.body).sort(), ["message", "success", "token", "user"]);
  assert.deepEqual(res.body.user, {
    id: "user-login",
    name: "Login User",
    email: "login@example.test",
  });
  assert.equal(typeof res.body.token, "string");
  assert.equal(JSON.stringify(res.body).includes("stored-hash-secret"), false);
  assert.equal(JSON.stringify(res.body).includes("correct-password"), false);
  assert.deepEqual(state.compareCalls, [{
    password: "correct-password",
    hash: "stored-hash-secret",
  }]);
});

test("login returns the existing 401 response for an unknown email", async () => {
  resetState();
  state.findOneResult = null;
  const res = makeResponse();

  await authController.login(
    { body: { email: "unknown@example.test", password: "guess" } },
    res
  );

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { success: false, message: "Invalid email or password" });
  assert.equal(state.compareCalls.length, 0);
});

test("login returns the existing 401 response for an incorrect password", async () => {
  resetState();
  state.findOneResult = {
    _id: "user-login",
    name: "Login User",
    email: "login@example.test",
    password: "private-password-hash",
  };
  state.compareResult = false;
  const res = makeResponse();

  await authController.login(
    { body: { email: "login@example.test", password: "wrong-password" } },
    res
  );

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { success: false, message: "Invalid email or password" });
  assert.equal(JSON.stringify(res.body).includes("private-password-hash"), false);
  assert.equal(JSON.stringify(res.body).includes("wrong-password"), false);
});

test("registration hashes with bcryptjs cost 10 and preserves its response shape", async () => {
  resetState();
  state.findOneResult = null;
  const res = makeResponse();

  await authController.register(
    { body: { name: "New User", email: "new@example.test", password: "plain-secret" } },
    res
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.message, "Registration successful");
  assert.deepEqual(Object.keys(res.body).sort(), ["message", "success", "token", "user"]);
  assert.equal(typeof res.body.token, "string");
  assert.deepEqual(res.body.user, {
    id: "user-created",
    name: "Test User",
    email: "test@example.test",
  });
  assert.deepEqual(state.hashCalls, [{ password: "plain-secret", rounds: 10 }]);
  assert.deepEqual(state.createCalls, [{
    name: "New User",
    email: "new@example.test",
    password: "mock-bcrypt-hash",
  }]);
  assert.equal(JSON.stringify(res.body).includes("mock-bcrypt-hash"), false);
  assert.equal(JSON.stringify(res.body).includes("plain-secret"), false);
});

test("registration returns the existing failure response for a duplicate email", async () => {
  resetState();
  state.findOneResult = { _id: "existing-user" };
  const res = makeResponse();

  await authController.register(
    { body: { name: "Existing", email: "existing@example.test", password: "password" } },
    res
  );

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { success: false, message: "User already exists" });
  assert.equal(state.hashCalls.length, 0);
  assert.equal(state.createCalls.length, 0);
});

test("profile route returns only the expected fields for a valid authenticated request", () => {
  const [protect, profileHandler] = loadProfileRoute();
  const req = { headers: { authorization: `Bearer ${tokenFor("profile-user")}` } };
  const res = makeResponse();
  let nextCalled = false;
  protect(req, res, () => {
    nextCalled = true;
    profileHandler(req, res);
  });

  assert.equal(nextCalled, true);
  assert.deepEqual(res.body, {
    success: true,
    message: "You accessed a protected route!",
    userId: "profile-user",
  });
  assert.equal(Object.hasOwn(res.body, "password"), false);
  assert.equal(JSON.stringify(res.body).includes(TEST_SECRET), false);
});

test("profile route rejects missing and invalid authentication", () => {
  const [protect, profileHandler] = loadProfileRoute();

  for (const authorization of [undefined, "Bearer invalid-profile-token"]) {
    const req = { headers: {} };
    if (authorization !== undefined) req.headers.authorization = authorization;
    const res = makeResponse();
    let profileReached = false;
    withSuppressedVerificationLogs(() => {
      protect(req, res, () => {
        profileReached = true;
        profileHandler(req, res);
      });
    });

    assert.equal(res.statusCode, 401);
    assert.equal(profileReached, false);
    assert.equal(JSON.stringify(res.body).includes("invalid-profile-token"), false);
    assert.equal(JSON.stringify(res.body).includes(TEST_SECRET), false);
  }
});
