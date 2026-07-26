// Deep links into the theora web app. Mirrors the frontend URL grammar:
// src/workspaces/research/urls.ts (buildWalkthroughDemoUrl) and
// src/lib/urlState.ts (encodeState). Keep the short keys in sync.

export const DEMO_PARAM_KEYS: Record<string, string> = {
  pipeline: "pl",
  merkle: "m",
  polynomial: "p",
  accumulator: "a",
  recursive: "r",
  "split-accumulation": "sa",
  rerandomization: "rr",
  "oblivious-sync": "os",
  elliptic: "e",
  "fiat-shamir": "fs",
  circuit: "c",
  lookup: "l",
  pedersen: "ped",
  "constraint-counter": "cc",
  plonk: "plk",
  groth16: "g16",
  sumcheck: "sc",
  fri: "fri",
  nova: "nova",
  mle: "mle",
  gkr: "gkr",
  "proof-trace": "pt",
  "constraint-editor": "ce",
};

export const DEMO_IDS = Object.keys(DEMO_PARAM_KEYS);

export type AppMode = "explore" | "attack" | "debug" | "predict";

/** UTF-8 base64 of JSON — identical output to the frontend's encodeState (btoa). */
export function encodeState(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

export function resolveOrigin(origin?: string): string {
  return origin || process.env.THEORA_ORIGIN || "https://www.theora.dev";
}

export interface BuildDemoUrlOptions {
  embed?: boolean;
  mode?: AppMode;
  origin?: string;
}

export function buildDemoUrl(
  demo: string,
  state: Record<string, unknown>,
  options: BuildDemoUrlOptions = {},
): string {
  const key = DEMO_PARAM_KEYS[demo];
  if (!key) {
    throw new Error(`Unknown demo id: ${demo}`);
  }
  const url = new URL("/app", resolveOrigin(options.origin));
  if (options.embed) {
    url.searchParams.set("embed", demo);
  } else {
    url.hash = demo;
  }
  if (Object.keys(state).length > 0) {
    url.searchParams.set(key, encodeState(state));
  }
  if (options.mode && options.mode !== "explore") {
    url.searchParams.set("mode", options.mode);
  }
  return url.toString();
}

export interface CircuitDocumentV1 {
  v: 1;
  source: string;
  field: string;
  inputs: Record<string, string>;
}

export interface BuildEditorUrlOptions {
  source: string;
  inputs?: Record<string, string>;
  field?: string;
  embed?: boolean;
  origin?: string;
}

export function buildEditorUrl(options: BuildEditorUrlOptions): string {
  const document: CircuitDocumentV1 = {
    v: 1,
    source: options.source,
    field: options.field || "101",
    inputs: options.inputs ?? {},
  };
  return buildDemoUrl("constraint-editor", document as unknown as Record<string, unknown>, {
    embed: options.embed ?? true,
    origin: options.origin,
  });
}
