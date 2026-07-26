import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildDemoUrl, buildEditorUrl, DEMO_IDS, DEMO_PARAM_KEYS } from "../lib/appUrl.js";

const originSchema = z.string().url().optional().describe("App origin override. Default THEORA_ORIGIN env var or https://www.theora.dev");

export function registerUrlTools(server: McpServer) {
  server.tool(
    "build_demo_url",
    "Build a shareable theora web-app URL for any demo, optionally with an embedded (chrome-less) view, a mode (attack/debug/predict), and a state payload. Use this to hand a human a clickable link to exactly what you computed.",
    {
      demo: z.enum(DEMO_IDS as [string, ...string[]]).describe("Demo id"),
      state: z.record(z.unknown()).default({}).describe("Demo-specific state payload, serialized under the demo's short query key. Each demo restores only the keys its deserializer knows; unknown keys are ignored."),
      embed: z.boolean().default(false).describe("true -> ?embed=<demo> (iframe-friendly, no chrome); false -> /app#<demo>"),
      mode: z.enum(["explore", "attack", "debug", "predict"]).optional().describe("App mode to open in"),
      origin: originSchema,
    },
    async ({ demo, state, embed, mode, origin }) => {
      try {
        const url = buildDemoUrl(demo, state, { embed, mode, origin });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              url,
              paramKey: DEMO_PARAM_KEYS[demo],
              note: "State is base64(JSON) under the demo's short query key. Demos restore defensively: unknown or malformed keys fall back to defaults silently.",
            }),
          }],
        };
      } catch (e) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(e) }) }] };
      }
    },
  );

  server.tool(
    "build_editor_url",
    "Build a theora constraint-editor URL preloading DSL source, witness inputs, and field. The link opens the circuit live in the browser — present it to the human after authoring or auditing a circuit.",
    {
      source: z.string().min(1).describe("Constraint-DSL source"),
      inputs: z.record(z.string().regex(/^-?\d+$/)).optional().describe("Wire name -> decimal value"),
      field: z.string().regex(/^\d+$/).optional().describe("Prime field modulus, default 101"),
      embed: z.boolean().default(true).describe("true -> embedded chrome-less view"),
      origin: originSchema,
    },
    async ({ source, inputs, field, embed, origin }) => {
      try {
        const url = buildEditorUrl({ source, inputs, field, embed, origin });
        return { content: [{ type: "text" as const, text: JSON.stringify({ url }) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ error: String(e) }) }] };
      }
    },
  );
}
