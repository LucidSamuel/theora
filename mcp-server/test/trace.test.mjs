import test from "node:test";
import assert from "node:assert/strict";

import { registerTraceTools } from "../build/tools/trace.js";
import { canonicalStringify, transcriptFingerprint, validateTrace } from "../build/lib/traceSchema.js";

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

// Worked example from DESIGN-PROOF-TRACE.md. The hash below is the frozen
// contract shared with src/__tests__/proofTrace.test.ts — never change it.
const PINNED_EXAMPLE_HASH = "227124dcc5e09f7f1efcff1a80f856871031f36c8cc1ba75f9c40523214a9a42";

const exampleTrace = {
  version: 1,
  meta: { system: "theora", protocol: "sumcheck", field: "101" },
  transcript: [
    { t: "absorb", round: 0, label: "claimed sum", data: ["36"] },
    { t: "absorb", round: 1, label: "g_1 coefficients", data: ["10", "16"] },
    { t: "check", round: 1, label: "g_1(0)+g_1(1) = S", ok: true },
    { t: "challenge", round: 1, label: "r_1", data: ["7"] },
    { t: "absorb", round: 2, label: "g_2 coefficients", data: ["55", "12"] },
    { t: "check", round: 2, label: "g_2(0)+g_2(1) = g_1(r_1)", ok: true },
    { t: "challenge", round: 2, label: "r_2", data: ["13"] },
    { t: "query", round: 3, label: "oracle f(r_1,r_2)", data: ["42"] },
    { t: "check", round: 3, label: "final", ok: true },
  ],
};

test("trace_fingerprint matches the pinned frontend contract hash", async () => {
  const mock = createMockServer();
  registerTraceTools(mock.server);

  const result = await invokeTool(mock, "trace_fingerprint", { trace: exampleTrace });
  assert.equal(result.fingerprint, PINNED_EXAMPLE_HASH);
  assert.equal(result.algorithm, "sha256/canonical-json-v1");
  assert.equal(result.eventCount, 9);
  assert.ok(result.preimagePrefix.startsWith("theora/proof-trace/v1|sumcheck|101|"));
});

test("fingerprint is invariant under key reordering and meta annotations", () => {
  const reordered = {
    meta: { field: "101", protocol: "sumcheck", system: "renamed-system", label: "x", createdAt: "2026-01-01" },
    transcript: exampleTrace.transcript.map((e) => Object.fromEntries(Object.entries(e).reverse())),
    version: 1,
    rounds: [{ round: 1, label: "round one" }],
  };
  const validated = validateTrace(reordered);
  assert.equal(validated.valid, true);
  assert.equal(transcriptFingerprint(validated.trace), PINNED_EXAMPLE_HASH);
});

test("fingerprint changes when a transcript event mutates", () => {
  const mutated = JSON.parse(JSON.stringify(exampleTrace));
  mutated.transcript[1].data = ["10", "17"];
  const validated = validateTrace(mutated);
  assert.equal(validated.valid, true);
  assert.notEqual(transcriptFingerprint(validated.trace), PINNED_EXAMPLE_HASH);
});

test("normalization drops empty data arrays before hashing", () => {
  const noisy = JSON.parse(JSON.stringify(exampleTrace));
  noisy.transcript[0].data = [];
  const clean = JSON.parse(JSON.stringify(exampleTrace));
  delete clean.transcript[0].data;
  assert.equal(
    transcriptFingerprint(validateTrace(noisy).trace),
    transcriptFingerprint(validateTrace(clean).trace),
  );
});

test("trace_validate rejects bad shapes with paths", async () => {
  const mock = createMockServer();
  registerTraceTools(mock.server);

  const missingVersion = await invokeTool(mock, "trace_validate", {
    trace: { meta: exampleTrace.meta, transcript: exampleTrace.transcript },
  });
  assert.equal(missingVersion.valid, false);
  assert.ok(missingVersion.errors.some((e) => e.path === "version"));

  const badEvent = await invokeTool(mock, "trace_validate", {
    trace: { ...exampleTrace, transcript: [{ t: "squeeze", round: 0, label: "x" }] },
  });
  assert.equal(badEvent.valid, false);
  assert.ok(badEvent.errors.some((e) => e.path.startsWith("transcript.0")));

  const strayOk = await invokeTool(mock, "trace_validate", {
    trace: { ...exampleTrace, transcript: [{ t: "absorb", round: 0, label: "x", ok: true }] },
  });
  assert.equal(strayOk.valid, false);
  assert.ok(strayOk.errors.some((e) => e.message.includes("only allowed on check")));

  const badWireRef = await invokeTool(mock, "trace_validate", {
    trace: {
      ...exampleTrace,
      constraints: {
        wires: [{ id: 0, name: "one", type: "one" }],
        constraints: [{ id: 0, a: [[5, "1"]], b: [], c: [] }],
      },
    },
  });
  assert.equal(badWireRef.valid, false);
  assert.ok(badWireRef.errors.some((e) => e.message.includes("unknown wire id 5")));
});

test("canonicalStringify sorts keys and omits undefined", () => {
  assert.equal(
    canonicalStringify({ b: 1, a: [2, { d: 3, c: 4 }], e: undefined }),
    '{"a":[2,{"c":4,"d":3}],"b":1}',
  );
});

test("trace_validate accepts the worked example", async () => {
  const mock = createMockServer();
  registerTraceTools(mock.server);
  const result = await invokeTool(mock, "trace_validate", { trace: exampleTrace });
  assert.equal(result.valid, true);
  assert.equal(result.eventCount, 9);
});
