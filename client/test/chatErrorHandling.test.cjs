const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createServer } = require("vite");

const clientRoot = path.resolve(__dirname, "..");
const virtualIds = {
  react: "\0chat-react-mock",
  router: "\0chat-router-mock",
  api: "\0chat-api-mock",
  icons: "\0chat-icons-mock",
};

const testPlugin = {
  name: "chat-test-mocks",
  enforce: "pre",
  resolveId(source) {
    if (source === "virtual:chat-react-mock") return virtualIds.react;
    if (source === "virtual:chat-router-mock") return virtualIds.router;
    if (source === "virtual:chat-api-mock") return virtualIds.api;
    if (source === "virtual:chat-icons-mock") return virtualIds.icons;
    return null;
  },
  transform(code, id) {
    if (!id.includes("/src/pages/Chat.jsx")) return null;
    return code
      .replace('from "react"', 'from "virtual:chat-react-mock"')
      .replace('from "react-router-dom"', 'from "virtual:chat-router-mock"')
      .replace('from "lucide-react"', 'from "virtual:chat-icons-mock"')
      .replace('from "../services/api"', 'from "virtual:chat-api-mock"');
  },
  load(id) {
    if (id === virtualIds.react) {
      return `
        export const useState = (...args) => globalThis.__chatHarness.useState(...args);
        export const useEffect = (...args) => globalThis.__chatHarness.useEffect(...args);
        export const useRef = (...args) => globalThis.__chatHarness.useRef(...args);
      `;
    }
    if (id === virtualIds.router) {
      return `
        export const useLocation = () => globalThis.__chatHarness.location;
        export const useNavigate = () => globalThis.__chatHarness.navigate;
      `;
    }
    if (id === virtualIds.api) return "export default globalThis.__chatHarness.api;";
    if (id === virtualIds.icons) {
      return [
        "ArrowUpRight", "Bot", "FileText", "Loader2", "MessageSquare", "Plus",
        "Send", "User", "Sparkles", "AlertCircle", "CheckCircle2", "BookOpen",
        "ShieldCheck",
      ].map((name) => `export const ${name} = ${JSON.stringify(name)};`).join("\n");
    }
    return null;
  },
};

let viteServer;
let Chat;
let harness;
const sharedHarness = {
  api: {
    get(...args) { return harness.api.get(...args); },
    post(...args) { return harness.api.post(...args); },
  },
  useState() { throw new Error("Chat test harness is not initialized"); },
  useEffect() { throw new Error("Chat test harness is not initialized"); },
  useRef() { throw new Error("Chat test harness is not initialized"); },
};
globalThis.__chatHarness = sharedHarness;

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const createHarness = (postHandlers = []) => {
  const stateValues = [];
  const refs = [];
  const effectDependencies = [];
  let hookIndex = 0;
  let pendingEffects = [];
  const calls = [];

  harness = {
    stateValues,
    calls,
    location: { state: { documentId: "document-1" } },
    navigate() {},
    api: {
      async get() {
        return { data: { documents: [{ _id: "document-1", status: "ready", title: "Test PDF" }] } };
      },
      post(path, body) {
        calls.push({ path, body });
        const handler = postHandlers.shift();
        if (!handler) throw new Error("Unexpected POST request");
        return typeof handler === "function" ? handler(path, body) : handler;
      },
    },
    useState(initialValue) {
      const index = hookIndex++;
      if (!(index in stateValues)) stateValues[index] = initialValue;
      return [stateValues[index], (nextValue) => {
        stateValues[index] = typeof nextValue === "function"
          ? nextValue(stateValues[index])
          : nextValue;
      }];
    },
    useRef(initialValue) {
      const index = hookIndex++;
      if (!(index in refs)) refs[index] = { current: initialValue };
      return refs[index];
    },
    useEffect(effect, dependencies) {
      const index = hookIndex++;
      const previous = effectDependencies[index];
      const changed = !previous || dependencies.some((value, position) =>
        !Object.is(value, previous[position])
      );
      if (changed) {
        effectDependencies[index] = dependencies;
        pendingEffects.push(effect);
      }
    },
    render() {
      hookIndex = 0;
      pendingEffects = [];
      return Chat();
    },
    flushEffects() {
      const effects = pendingEffects;
      pendingEffects = [];
      effects.forEach((effect) => effect());
    },
  };

  sharedHarness.useState = (...args) => harness.useState(...args);
  sharedHarness.useRef = (...args) => harness.useRef(...args);
  sharedHarness.useEffect = (...args) => harness.useEffect(...args);
  sharedHarness.location = harness.location;
  sharedHarness.navigate = harness.navigate;

  return harness;
};

const settle = () => new Promise((resolve) => setImmediate(resolve));

const findElement = (element, predicate) => {
  if (Array.isArray(element)) {
    for (const child of element) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
    return null;
  }
  if (!element || typeof element !== "object") return null;
  if (predicate(element)) return element;
  const children = element.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return null;
};

const collectText = (element, result = []) => {
  if (Array.isArray(element)) {
    element.forEach((child) => collectText(child, result));
    return result;
  }
  if (typeof element === "string" || typeof element === "number") {
    result.push(String(element));
    return result;
  }
  if (!element || typeof element !== "object") return result;
  const children = element.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    collectText(child, result);
  }
  return result;
};

const renderReadyChat = async (postHandlers) => {
  const app = createHarness(postHandlers);
  app.render();
  app.flushEffects();
  await settle();
  return { app, tree: app.render() };
};

const ask = async (app, question) => {
  let tree = app.render();
  const input = findElement(tree, (element) => element.type === "input");
  input.props.onChange({ target: { value: question } });
  tree = app.render();
  const form = findElement(tree, (element) => element.type === "form");
  await form.props.onSubmit({ preventDefault() {} });
  return app.render();
};

test.before(async () => {
  globalThis.window = {
    requestAnimationFrame(callback) { callback(); return 1; },
    cancelAnimationFrame() {},
  };
  viteServer = await createServer({
    configFile: path.join(clientRoot, "vite.config.js"),
    root: clientRoot,
    appType: "custom",
    logLevel: "silent",
    plugins: [testPlugin],
    server: { middlewareMode: true },
  });
  ({ default: Chat } = await viteServer.ssrLoadModule("/src/pages/Chat.jsx"));
});

test.after(async () => {
  await viteServer?.close();
  delete globalThis.__chatHarness;
  delete globalThis.window;
});

test("connection failures show actionable text and offer retry", async () => {
  const { app } = await renderReadyChat([
    async () => { throw { isAxiosError: true, code: "ERR_NETWORK", message: "private technical detail" }; },
  ]);
  const tree = await ask(app, "What is the conclusion?");
  const text = collectText(tree).join(" ");

  assert.match(text, /Unable to connect to the server\. Check your connection and make sure the backend is running, then try again\./);
  assert.doesNotMatch(text, /private technical detail/);
  assert.ok(findElement(tree, (element) => element.type === "button" && element.props["aria-label"] === "Retry question: What is the conclusion?"));
});

test("HTTP errors display the backend message without replacing it with connection copy", async () => {
  const { app } = await renderReadyChat([
    async () => { throw { response: { status: 500, data: { message: "Failed to generate answer" } } }; },
  ]);
  const tree = await ask(app, "Explain the result");
  const text = collectText(tree).join(" ");

  assert.match(text, /Failed to generate answer/);
  assert.doesNotMatch(text, /Unable to connect to the server/);
});

test("unexpected non-Axios errors use the safe generic fallback", async () => {
  const { app } = await renderReadyChat([
    async () => { throw new Error("internal implementation detail"); },
  ]);
  const tree = await ask(app, "Explain this section");
  const text = collectText(tree).join(" ");

  assert.match(text, /Sorry, I couldn't process your question\. Please try again\./);
  assert.doesNotMatch(text, /internal implementation detail|Unable to connect to the server/);
});

test("retry reuses the original question and document, replaces the failure, and blocks concurrent retries", async () => {
  const pendingRetry = createDeferred();
  const { app } = await renderReadyChat([
    async () => ({ data: { answer: "Earlier answer", sources: [] } }),
    async () => { throw { response: { status: 503, data: { message: "Temporary service error" } } }; },
    () => pendingRetry.promise,
  ]);

  await ask(app, "First question");
  let tree = await ask(app, "Question to retry");
  let retry = findElement(tree, (element) => element.type === "button" && element.props["aria-label"] === "Retry question: Question to retry");
  const firstRetry = retry.props.onClick();
  const duplicateRetry = await retry.props.onClick();

  assert.equal(app.calls.length, 3);
  assert.equal(app.calls[2].path, "/documents/ask");
  assert.deepEqual(app.calls[2].body, {
    query: "Question to retry",
    documentId: "document-1",
  });
  assert.equal(duplicateRetry, undefined);

  pendingRetry.resolve({ data: { answer: "Recovered answer", sources: [] } });
  await firstRetry;
  tree = app.render();
  const stateMessages = app.stateValues[5];
  const text = collectText(tree).join(" ");

  assert.equal(stateMessages.filter((message) => message.role === "user" && message.content === "Question to retry").length, 1);
  assert.equal(stateMessages.filter((message) => message.content === "Temporary service error").length, 0);
  assert.equal(stateMessages.filter((message) => message.content === "Recovered answer").length, 1);
  assert.match(text, /Earlier answer/);
  assert.match(text, /Recovered answer/);
  assert.doesNotMatch(text, /Temporary service error/);
  assert.equal(app.stateValues[1], "document-1");
});

test("no-evidence answers are distinguished while preserving their text and available source cards", async () => {
  const abstention = "I couldn't find this information in the provided document.";
  const noResults = "I couldn't find relevant information in this document.";
  for (const answer of [abstention, noResults]) {
    const { app } = await renderReadyChat([
      async () => ({
        data: {
          answer,
          sources: answer === abstention
            ? [{ chunkId: "chunk-1", pageNumber: 2, score: 0.42, snippet: "Retrieved evidence excerpt" }]
            : [],
        },
      }),
    ]);

    const tree = await ask(app, "What does the policy say?");
    const text = collectText(tree).join(" ");
    assert.match(text, /No evidence found/);
    assert.ok(text.includes(answer));
    if (answer === abstention) {
      assert.match(text, /Retrieved sources \(\s*1\s*\)/);
      assert.match(text, /Page 2/);
    }
    assert.doesNotMatch(text, /Unable to connect to the server/);
  }
});
