import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fingerprintPreimage, transcriptFingerprint, validateTrace } from "../lib/traceSchema.js";

export function registerTraceTools(server: McpServer) {
  server.tool(
    "trace_validate",
    "Validate a proof-trace JSON document against the theora trace.json v1 schema. Returns per-path errors on failure.",
    { trace: z.unknown().describe("The parsed trace.json object") },
    async ({ trace }) => {
      try {
        const result = validateTrace(trace);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(
              result.valid
                ? { valid: true, eventCount: result.trace!.transcript.length }
                : { valid: false, errors: result.errors },
            ),
          }],
        };
      } catch (e) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(e) }) }] };
      }
    },
  );

  server.tool(
    "trace_fingerprint",
    "Compute the canonical transcript fingerprint of a proof-trace JSON document (sha256 over the frozen canonical-JSON preimage). Identical to the fingerprint shown in the theora proof-trace demo.",
    { trace: z.unknown().describe("The parsed trace.json object") },
    async ({ trace }) => {
      try {
        const result = validateTrace(trace);
        if (!result.valid || !result.trace) {
          return { content: [{ type: "text" as const, text: JSON.stringify({ error: "invalid trace", errors: result.errors }) }] };
        }
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              fingerprint: transcriptFingerprint(result.trace),
              algorithm: "sha256/canonical-json-v1",
              eventCount: result.trace.transcript.length,
              preimagePrefix: fingerprintPreimage(result.trace).slice(0, 80),
            }),
          }],
        };
      } catch (e) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(e) }) }] };
      }
    },
  );
}
