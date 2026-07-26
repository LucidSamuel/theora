// Drift guard: the vendored DSL must stay byte-identical to the frontend
// copy in src/lib/dsl, modulo Node16 `.js` import extensions.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const frontendDsl = join(repoRoot, "src", "lib", "dsl");
const vendoredDsl = join(here, "..", "src", "lib", "dsl");

const VENDORED_FILES = [
  "types.ts",
  "parser.ts",
  "compiler.ts",
  "witness.ts",
  "checker.ts",
  "analyzer.ts",
  "exhaustive.ts",
  "defaults.ts",
];

function normalizeVendored(source) {
  return source
    .replace(/from '(\.\/[a-z]+)\.js'/g, "from '$1'")
    .replace(/import\('(\.\/[a-z]+)\.js'\)/g, "import('$1')");
}

for (const file of VENDORED_FILES) {
  test(`vendored dsl/${file} matches src/lib/dsl/${file}`, () => {
    const frontend = readFileSync(join(frontendDsl, file), "utf8");
    const vendored = readFileSync(join(vendoredDsl, file), "utf8");
    assert.equal(
      normalizeVendored(vendored),
      frontend,
      `mcp-server/src/lib/dsl/${file} has drifted from src/lib/dsl/${file} — re-vendor it (copy + add .js import extensions)`,
    );
  });
}
