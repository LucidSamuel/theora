#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerMerkleTools } from "./tools/merkle.js";
import { registerPolynomialTools } from "./tools/polynomial.js";
import { registerAccumulatorTools } from "./tools/accumulator.js";
import { registerRecursiveTools } from "./tools/recursive.js";
import { registerEllipticTools } from "./tools/elliptic.js";
import { registerFiatShamirTools } from "./tools/fiat-shamir.js";
import { registerCircuitTools } from "./tools/circuit.js";
import { registerLookupTools } from "./tools/lookup.js";
import { registerPipelineTools } from "./tools/pipeline.js";
import { registerResources } from "./resources/schemas.js";
import { registerPrompts } from "./prompts/index.js";

const server = new McpServer({
  name: "theora",
  version: "0.1.0",
});

// Register all tool groups
registerMerkleTools(server);
registerPolynomialTools(server);
registerAccumulatorTools(server);
registerRecursiveTools(server);
registerEllipticTools(server);
registerFiatShamirTools(server);
registerCircuitTools(server);
registerLookupTools(server);
registerPipelineTools(server);

// Register resources and prompts
registerResources(server);
registerPrompts(server);

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
