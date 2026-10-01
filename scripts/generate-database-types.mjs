import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const source = execFileSync(
  process.execPath,
  [require.resolve("supabase/dist/supabase.js"), "gen", "types", "typescript", "--schema", "public", ...(args.length ? args : ["--local"])],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
);
const ast = ts.createSourceFile("database.types.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const formatted = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(ast);
// Write only after generation succeeds, preserving the last valid file on errors.
writeFileSync(new URL("../lib/db/database.types.ts", import.meta.url),
  "// Generated from migrations by npm run db:types. Do not edit manually.\n" + formatted);
