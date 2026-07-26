import test from "node:test";
import assert from "node:assert/strict";

import { registerUrlTools } from "../build/tools/urls.js";
import { encodeState, buildDemoUrl } from "../build/lib/appUrl.js";

function createMockServer() {
  const tools = new Map();
  return {
    server: {
      tool(name, _description, _schema, handler) {
        tools.set(name, handler);
      },
    },
    tools,
  };
}

async function invokeTool(serverState, name, input) {
  const handler = serverState.tools.get(name);
  assert.ok(handler, `Expected tool ${name} to be registered`);
  const response = await handler(input);
  return JSON.parse(response.content[0].text);
}

test("encodeState matches the frontend btoa formula (golden literal)", () => {
  // Frontend: btoa(unescape(encodeURIComponent(JSON.stringify({ x: 7 })))) === "eyJ4Ijo3fQ=="
  assert.equal(encodeState({ x: 7 }), "eyJ4Ijo3fQ==");
  // Unicode round-trip parity: β must survive the UTF-8 base64 path.
  const unicodeState = { label: "β-fold" };
  assert.equal(
    Buffer.from(encodeState(unicodeState), "base64").toString("utf8"),
    JSON.stringify(unicodeState),
  );
});

test("build_demo_url mirrors buildWalkthroughDemoUrl: hash mode, short key, decodable state", async () => {
  const mock = createMockServer();
  registerUrlTools(mock.server);

  const result = await invokeTool(mock, "build_demo_url", {
    demo: "merkle",
    state: { leaves: ["a", "b"], selectedLeafIndex: 1 },
    embed: false,
  });
  const url = new URL(result.url);
  assert.equal(url.hash, "#merkle");
  assert.equal(result.paramKey, "m");
  const decoded = JSON.parse(Buffer.from(url.searchParams.get("m"), "base64").toString("utf8"));
  assert.deepEqual(decoded, { leaves: ["a", "b"], selectedLeafIndex: 1 });
});

test("build_demo_url supports embed and mode params", async () => {
  const mock = createMockServer();
  registerUrlTools(mock.server);

  const result = await invokeTool(mock, "build_demo_url", {
    demo: "circuit",
    state: {},
    embed: true,
    mode: "debug",
  });
  const url = new URL(result.url);
  assert.equal(url.searchParams.get("embed"), "circuit");
  assert.equal(url.searchParams.get("mode"), "debug");
  assert.equal(url.hash, "");
  assert.equal(url.searchParams.has("c"), false, "empty state must not set the demo param");
});

test("build_editor_url encodes a CircuitDocumentV1 under the ce key", async () => {
  const mock = createMockServer();
  registerUrlTools(mock.server);

  const source = "input x\npublic out\nwire t = x * x\nassert t == out";
  const result = await invokeTool(mock, "build_editor_url", {
    source,
    inputs: { x: "3", out: "9" },
  });
  const url = new URL(result.url);
  assert.equal(url.searchParams.get("embed"), "constraint-editor");
  const doc = JSON.parse(Buffer.from(url.searchParams.get("ce"), "base64").toString("utf8"));
  assert.deepEqual(doc, { v: 1, source, field: "101", inputs: { x: "3", out: "9" } });
});

test("origin resolution prefers explicit origin, then THEORA_ORIGIN, then production", () => {
  const explicit = buildDemoUrl("fri", {}, { origin: "http://localhost:5173" });
  assert.ok(explicit.startsWith("http://localhost:5173/app"));

  process.env.THEORA_ORIGIN = "https://staging.theora.dev";
  try {
    assert.ok(buildDemoUrl("fri", {}, {}).startsWith("https://staging.theora.dev/app"));
  } finally {
    delete process.env.THEORA_ORIGIN;
  }

  assert.ok(buildDemoUrl("fri", {}, {}).startsWith("https://www.theora.dev/app"));
});

test("build_demo_url rejects unknown demo ids at the schema boundary", async () => {
  const mock = createMockServer();
  registerUrlTools(mock.server);
  // The mock bypasses zod validation, so the library-level guard must throw -> error JSON.
  const result = await invokeTool(mock, "build_demo_url", { demo: "not-a-demo", state: {}, embed: false });
  assert.ok(result.error.includes("Unknown demo id"));
});
