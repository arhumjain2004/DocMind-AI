const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createServer } = require("vite");

const clientRoot = path.resolve(__dirname, "..");
const mockReactId = "\0protected-route-react-mock";
const mockRouterId = "\0protected-route-router-mock";
const mockApiId = "\0protected-route-api-mock";

const testPlugin = {
  name: "protected-route-test-mocks",
  enforce: "pre",
  resolveId(source, importer) {
    if (source === "virtual:protected-route-react-mock") {
      return mockReactId;
    }
    if (source === "virtual:protected-route-router-mock") {
      return mockRouterId;
    }
    if (source === "virtual:protected-route-api-mock") {
      return mockApiId;
    }
    return null;
  },
  transform(code, id) {
    if (!id.includes("/src/components/ProtectedRoute.jsx")) return null;
    return code
      .replace('from "react"', 'from "virtual:protected-route-react-mock"')
      .replace('from "react-router-dom"', 'from "virtual:protected-route-router-mock"')
      .replace('from "../services/api"', 'from "virtual:protected-route-api-mock"');
  },
  load(id) {
    if (id === mockReactId) {
      return `
        export const useState = (...args) => globalThis.__protectedRouteHarness.useState(...args);
        export const useEffect = (...args) => globalThis.__protectedRouteHarness.useEffect(...args);
        export const useRef = (...args) => globalThis.__protectedRouteHarness.useRef(...args);
      `;
    }
    if (id === mockRouterId) {
      return "export const Navigate = globalThis.__protectedRouteHarness.Navigate;";
    }
    if (id === mockApiId) {
      return "export default globalThis.__protectedRouteHarness.api;";
    }
    return null;
  },
};

let viteServer;
let ProtectedRoute;
const NavigateMock = function NavigateMock() {};
const protectedContent = { type: "protected-content" };
let harness;
const sharedApi = { get() { throw new Error("Test API mock was not initialized"); } };
const sharedHarness = {
  Navigate: NavigateMock,
  api: sharedApi,
  useState() { throw new Error("Test hooks were not initialized"); },
  useEffect() { throw new Error("Test hooks were not initialized"); },
  useRef() { throw new Error("Test hooks were not initialized"); },
};
globalThis.__protectedRouteHarness = sharedHarness;

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const createHarness = (token = "session-token") => {
  const values = token ? { token, user: "cached-user" } : {};
  const requests = [];
  let hookIndex = 0;
  let effectsToRun = [];
  const hookValues = [];
  const effectDependencies = [];
  const effectCleanups = [];
  let stateUpdates = 0;

  harness = {
    Navigate: NavigateMock,
    api: {
      get(path) {
        const deferred = createDeferred();
        requests.push({ path, ...deferred });
        return deferred.promise;
      },
    },
    requests,
    values,
    get stateUpdates() {
      return stateUpdates;
    },
    useState(initialValue) {
      const index = hookIndex++;
      if (!(index in hookValues)) hookValues[index] = initialValue;
      return [hookValues[index], (nextValue) => {
        const resolvedValue = typeof nextValue === "function"
          ? nextValue(hookValues[index])
          : nextValue;
        if (!Object.is(hookValues[index], resolvedValue)) {
          hookValues[index] = resolvedValue;
          stateUpdates += 1;
        }
      }];
    },
    useRef(initialValue) {
      const index = hookIndex++;
      if (!(index in hookValues)) hookValues[index] = { current: initialValue };
      return hookValues[index];
    },
    useEffect(effect, dependencies) {
      const index = hookIndex++;
      const previousDependencies = effectDependencies[index];
      const changed = !previousDependencies ||
        dependencies.some((value, dependencyIndex) =>
          !Object.is(value, previousDependencies[dependencyIndex])
        );
      if (changed) {
        effectDependencies[index] = dependencies;
        effectsToRun.push({ index, effect });
      }
    },
  };

  sharedApi.get = (...args) => harness.api.get(...args);
  sharedHarness.useState = (...args) => harness.useState(...args);
  sharedHarness.useEffect = (...args) => harness.useEffect(...args);
  sharedHarness.useRef = (...args) => harness.useRef(...args);
  globalThis.localStorage = {
    getItem(key) {
      return values[key] ?? null;
    },
    removeItem(key) {
      delete values[key];
    },
  };

  return {
    requests,
    values,
    render() {
      hookIndex = 0;
      effectsToRun = [];
      return ProtectedRoute({ children: protectedContent });
    },
    flushEffects() {
      const pending = effectsToRun;
      effectsToRun = [];
      for (const { index, effect } of pending) {
        effectCleanups[index]?.();
        effectCleanups[index] = effect();
      }
    },
    unmount() {
      effectCleanups.forEach((cleanup) => cleanup?.());
    },
  };
};

const settlePromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const findButton = (element) => {
  if (!element || typeof element !== "object") return null;
  if (element.type === "button") return element;
  const children = element.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const match = findButton(child);
    if (match) return match;
  }
  return null;
};

const findByRole = (element, role) => {
  if (!element || typeof element !== "object") return null;
  if (element.props?.role === role) return element;
  const children = element.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const match = findByRole(child, role);
    if (match) return match;
  }
  return null;
};

test.before(async () => {
  viteServer = await createServer({
    configFile: path.join(clientRoot, "vite.config.js"),
    root: clientRoot,
    appType: "custom",
    logLevel: "silent",
    plugins: [testPlugin],
    server: { middlewareMode: true },
  });
  ({ default: ProtectedRoute } = await viteServer.ssrLoadModule(
    "/src/components/ProtectedRoute.jsx"
  ));
});

test.after(async () => {
  await viteServer?.close();
  delete globalThis.__protectedRouteHarness;
  delete globalThis.localStorage;
});

test("no token redirects immediately without requesting the profile", () => {
  const route = createHarness(null);
  const output = route.render();
  route.flushEffects();

  assert.equal(output.type, NavigateMock);
  assert.deepEqual(output.props, { to: "/login", replace: true });
  assert.equal(route.requests.length, 0);
});

test("valid session shows loading before rendering protected content", async () => {
  const route = createHarness();
  const loading = route.render();
  assert.equal(loading.props.role, "status");
  assert.match(loading.props.children.props.children, /Checking your session/);

  route.flushEffects();
  assert.equal(route.requests.length, 1);
  assert.equal(route.requests[0].path, "/users/profile");
  route.requests[0].resolve({ data: { success: true, userId: "user-1" } });
  await settlePromises();

  assert.equal(route.render(), protectedContent);
});

test("a replacement token must be validated before protected content renders", async () => {
  const route = createHarness("first-token");
  route.render();
  route.flushEffects();
  route.requests[0].resolve({ data: { success: true, userId: "user-1" } });
  await settlePromises();
  assert.equal(route.render(), protectedContent);

  route.values.token = "replacement-token";
  const loading = route.render();
  assert.equal(loading.props.role, "status");
  route.flushEffects();
  assert.equal(route.requests.length, 2);
  route.requests[1].resolve({ data: { success: true, userId: "user-2" } });
  await settlePromises();

  assert.equal(route.render(), protectedContent);
});

test("401 never renders protected content and leaves redirection to the API interceptor", async () => {
  const route = createHarness();
  route.render();
  route.flushEffects();
  route.requests[0].reject({ response: { status: 401 } });
  await settlePromises();

  assert.equal(route.render(), null);
  assert.equal(route.values.token, "session-token");
  assert.equal(route.values.user, "cached-user");
});

test("network failure shows a retry option without clearing the session", async () => {
  const route = createHarness();
  route.render();
  route.flushEffects();
  route.requests[0].reject({ code: "ERR_NETWORK" });
  await settlePromises();

  const errorView = route.render();
  assert.ok(findByRole(errorView, "alert"));
  assert.equal(route.values.token, "session-token");
  assert.equal(route.values.user, "cached-user");
  assert.equal(findButton(errorView).props.children, "Retry");
});

test("503 shows a retry option without clearing the session", async () => {
  const route = createHarness();
  route.render();
  route.flushEffects();
  route.requests[0].reject({ response: { status: 503 } });
  await settlePromises();

  const errorView = route.render();
  assert.ok(findByRole(errorView, "alert"));
  assert.equal(route.values.token, "session-token");
  assert.equal(route.values.user, "cached-user");
});

test("retry makes a new profile request and renders content after success", async () => {
  const route = createHarness();
  route.render();
  route.flushEffects();
  route.requests[0].reject({ response: { status: 503 } });
  await settlePromises();

  const errorView = route.render();
  findButton(errorView).props.onClick();
  const loading = route.render();
  assert.equal(loading.props.role, "status");
  route.flushEffects();

  assert.equal(route.requests.length, 2);
  assert.equal(route.requests[1].path, "/users/profile");
  route.requests[1].resolve({ data: { success: true, userId: "user-1" } });
  await settlePromises();
  assert.equal(route.render(), protectedContent);
});

test("unmount while validation is pending prevents later state updates", async () => {
  const route = createHarness();
  route.render();
  route.flushEffects();
  const updatesBeforeUnmount = harness.stateUpdates;
  route.unmount();

  route.requests[0].resolve({ data: { success: true, userId: "user-1" } });
  await settlePromises();

  assert.equal(harness.stateUpdates, updatesBeforeUnmount);
});

test("replayed effect setup reuses the pending request", () => {
  const route = createHarness();
  route.render();
  route.flushEffects();
  route.unmount();

  route.render();
  route.flushEffects();

  assert.equal(route.requests.length, 1);
});
