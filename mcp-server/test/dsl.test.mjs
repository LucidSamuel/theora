import test from "node:test";
import assert from "node:assert/strict";

import { registerDslTools } from "../build/tools/dsl.js";

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
  assert.equal(response.content[0]?.type, "text");
  return JSON.parse(response.content[0].text);
}

const SOUND_CIRCUIT = `input x
public out

wire t = x * x
wire u = t + x + 5
assert u == out`;

const UNDERCONSTRAINED_CIRCUIT = `input x
input t
public out

wire u = t + x + 5
assert u == out`;

test("dsl_parse returns statements for valid source and line/column errors for invalid source", async () => {
  const mock = createMockServer();
  registerDslTools(mock.server);

  const good = await invokeTool(mock, "dsl_parse", { source: SOUND_CIRCUIT });
  assert.equal(good.success, true);
  assert.deepEqual(good.statements[0], { type: "input", name: "x", line: 1 });
  assert.equal(good.statements.find((s) => s.type === "assert").left, "u");

  const bad = await invokeTool(mock, "dsl_parse", { source: "wire y = undefined_var + 1" });
  assert.equal(bad.success, false);
  assert.ok(bad.errors.length > 0);
  assert.equal(typeof bad.errors[0].line, "number");
  assert.equal(typeof bad.errors[0].column, "number");
});

test("dsl_compile compiles the basic circuit to R1CS", async () => {
  const mock = createMockServer();
  registerDslTools(mock.server);

  const result = await invokeTool(mock, "dsl_compile", { source: SOUND_CIRCUIT });
  assert.equal(result.success, true);
  assert.equal(result.fieldSize, "101");
  assert.ok(result.constraintCount >= 2);
  assert.ok(result.wires.some((w) => w.name === "t" && w.type === "intermediate"));
  const mul = result.constraints.find((c) => c.constraintType === "multiplication");
  assert.ok(mul, "expected a multiplication constraint for x * x");
});

test("dsl_analyze flags the underconstrained circuit and returns an editor URL", async () => {
  const mock = createMockServer();
  registerDslTools(mock.server);

  const sound = await invokeTool(mock, "dsl_analyze", { source: SOUND_CIRCUIT });
  assert.equal(sound.success, true);
  assert.deepEqual(sound.analysis.unconstrainedWires, []);
  assert.ok(sound.editorUrl.includes("constraint-editor"));

  const buggy = await invokeTool(mock, "dsl_analyze", { source: UNDERCONSTRAINED_CIRCUIT });
  assert.equal(buggy.success, true);
  assert.ok(
    buggy.analysis.weakInputWires.includes("t") || buggy.analysis.unconstrainedWires.includes("t"),
    `expected 't' to be flagged, got ${JSON.stringify(buggy.analysis)}`,
  );
  assert.ok(buggy.verdict.includes("t"));
});

test("dsl_witness_check passes honest inputs and fails dishonest ones with details", async () => {
  const mock = createMockServer();
  registerDslTools(mock.server);

  const honest = await invokeTool(mock, "dsl_witness_check", {
    source: SOUND_CIRCUIT,
    inputs: { x: "7", out: "61" },
  });
  assert.equal(honest.success, true);
  assert.equal(honest.allSatisfied, true);
  assert.ok(honest.editorUrl.includes("ce="));

  const dishonest = await invokeTool(mock, "dsl_witness_check", {
    source: SOUND_CIRCUIT,
    inputs: { x: "7", out: "12" },
  });
  assert.equal(dishonest.success, true);
  assert.equal(dishonest.allSatisfied, false);
  assert.ok(dishonest.failedConstraints.length > 0);
  const failed = dishonest.checks.find((c) => !c.satisfied);
  assert.ok(failed.mismatch, "expected mismatch details on the failed constraint");
});

test("dsl_exhaustive finds the exploit in the underconstrained circuit over a tiny field", async () => {
  const mock = createMockServer();
  registerDslTools(mock.server);

  const result = await invokeTool(mock, "dsl_exhaustive", {
    source: UNDERCONSTRAINED_CIRCUIT,
    field: "13",
    maxCombinations: 100000,
  });
  assert.equal(result.success, true);
  assert.equal(result.isInputDetermined, false);
});

test("dsl_exhaustive refuses oversized search spaces with an explanatory error", async () => {
  const mock = createMockServer();
  registerDslTools(mock.server);

  const result = await invokeTool(mock, "dsl_exhaustive", {
    source: UNDERCONSTRAINED_CIRCUIT,
    field: "101",
    maxCombinations: 1000,
  });
  assert.equal(result.success, false);
  assert.ok(result.error.includes("exceeds maxCombinations"));
});
