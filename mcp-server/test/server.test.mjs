import test from "node:test";
import assert from "node:assert/strict";

import { registerMerkleTools } from "../build/tools/merkle.js";
import { registerPipelineTools } from "../build/tools/pipeline.js";
import { registerCircuitTools } from "../build/tools/circuit.js";
import { registerResources } from "../build/resources/schemas.js";

function createMockServer() {
  const tools = new Map();
  const resources = new Map();

  return {
    server: {
      tool(name, _description, _schema, handler) {
        tools.set(name, handler);
      },
      resource(_name, uri, handler) {
        resources.set(uri, handler);
      },
    },
    tools,
    resources,
  };
}

async function invokeTool(serverState, name, input) {
  const handler = serverState.tools.get(name);
  assert.ok(handler, `Expected tool ${name} to be registered`);
  const response = await handler(input);
  assert.equal(response.content[0]?.type, "text");
  return JSON.parse(response.content[0].text);
}

async function invokeResource(serverState, uri) {
  const handler = serverState.resources.get(uri);
  assert.ok(handler, `Expected resource ${uri} to be registered`);
  const response = await handler();
  assert.equal(response.contents[0]?.uri, uri);
  return JSON.parse(response.contents[0].text);
}

test("merkle tools build, prove, and verify a valid proof", async () => {
  const mock = createMockServer();
  registerMerkleTools(mock.server);

  const build = await invokeTool(mock, "merkle_build", {
    leaves: ["alpha", "beta", "gamma", "delta"],
    hashFunction: "sha256",
  });
  assert.equal(build.leafCount, 4);
  assert.equal(typeof build.root, "string");

  const proof = await invokeTool(mock, "merkle_prove", {
    leaves: ["alpha", "beta", "gamma", "delta"],
    leafIndex: 2,
    hashFunction: "sha256",
  });
  assert.equal(proof.leafIndex, 2);
  assert.equal(proof.root, build.root);

  const verification = await invokeTool(mock, "merkle_verify", {
    proof,
    hashFunction: "sha256",
  });
  assert.equal(verification.valid, true);
});

test("pipeline tool reports the expected divergence for a bad opening", async () => {
  const mock = createMockServer();
  registerPipelineTools(mock.server);

  const result = await invokeTool(mock, "pipeline_run", {
    secretInput: 7,
    fault: "bad-opening",
    upToStage: "verify",
  });

  assert.equal(result.fault, "bad-opening");
  assert.equal(result.firstDivergence, "verify (quotient)");
  assert.equal(result.finalVerdict, false);
  assert.equal(result.stages.verify.quotientValid, false);
});

test("circuit exploit tool shows the exploit only passes the broken circuit", async () => {
  const mock = createMockServer();
  registerCircuitTools(mock.server);

  const result = await invokeTool(mock, "circuit_find_exploit", {
    x: 3,
    y: 4,
  });

  assert.equal(result.analysis.validPassesFullCircuit, true);
  assert.equal(result.analysis.exploitPassesFullCircuit, false);
  assert.equal(result.analysis.exploitPassesBrokenCircuit, true);
  assert.equal(result.isUnderconstrained, true);
});

test("resource registration exposes the demo catalog and import schema", async () => {
  const mock = createMockServer();
  registerResources(mock.server);

  const demos = await invokeResource(mock, "theora://demos/list");
  assert.equal(demos.demos.length, 9);
  assert.equal(demos.totalTools, 28);

  const pipeline = await invokeResource(mock, "theora://demos/pipeline/info");
  assert.equal(pipeline.id, "pipeline");
  assert.deepEqual(pipeline.tools, ["pipeline_run"]);
  assert.deepEqual(pipeline.importExportSchema.required, ["demo", "state"]);
});
