#!/usr/bin/env node
/**
 * Renames "wajha" -> "Shams_Elgroub" (case-matched) across the codebase.
 *
 * SAFE BY DEFAULT — dry-run only unless you pass --write:
 *   node rename-wajha.js            (prints every match, changes nothing)
 *   node rename-wajha.js --write    (actually rewrites the files)
 *
 * Run this from your repo root (the wajha-app folder, one level above
 * both frontend/ and backend/).
 *
 * WHAT THIS DOES rename (safe — purely internal to the app):
 *   - Comments and code documentation
 *   - UI text / dropdown labels ("Wajha progress (status) table", etc.)
 *   - Console log messages
 *   - Internal semantic keys (e.g. the "wajhaData" key used between
 *     admin.routes.js and adminImportExportService.js — these are
 *     app-internal identifiers now, not real DynamoDB table names,
 *     since the full Postgres migration)
 *   - The localStorage key for saved color preferences (renaming this
 *     means anyone's saved color customizations reset once, harmless)
 *
 * WHAT THIS DELIBERATELY SKIPS (flagged, not auto-changed):
 *   - Any line containing "process.env.DDB_" or an actual .env KEY name
 *     (e.g. DDB_WAJHA_DATA_TABLE) — these must match your real .env
 *     file's variable names exactly. This code path is no longer used
 *     by the live app (DynamoDB was fully replaced by Postgres), but
 *     renaming it here without also updating your real backend/.env
 *     would be a silent footgun if anything ever reads it again. If you
 *     want this renamed too, do it manually in both places at once.
 *   - node_modules, .git, dist/build folders
 *   - .env and .env.example files entirely (same reasoning as above —
 *     these define real config keys)
 *
 * After running with --write: restart both dev servers, and clear your
 * browser's localStorage for this app once (color preferences will
 * reset to default, nothing else is affected) since the storage key
 * changed.
 */
import { readFileSync, writeFileSync } from "fs";
import { join, extname } from "path";
import { execSync } from "child_process";

const WRITE = process.argv.includes("--write");
const ROOT = process.cwd();

const INCLUDE_EXT = new Set([".js", ".jsx", ".json", ".md", ".css", ".sql"]);
const EXCLUDE_DIRS = ["node_modules", ".git", "dist", "build", ".vercel"];
const EXCLUDE_FILES = [".env", ".env.example", "package-lock.json", "rename-wajha.js"]; // real config keys / auto-generated / self

function findFiles() {
  // Use git to list tracked+untracked-but-not-ignored files if this is
  // a git repo — respects .gitignore automatically (so node_modules
  // etc. are skipped even if EXCLUDE_DIRS misses something).
  try {
    const out = execSync("git ls-files --cached --others --exclude-standard", { cwd: ROOT, encoding: "utf8" });
    return out
      .split("\n")
      .filter(Boolean)
      .filter((f) => INCLUDE_EXT.has(extname(f)))
      .filter((f) => !EXCLUDE_DIRS.some((d) => f.includes(`${d}/`)))
      .filter((f) => !EXCLUDE_FILES.some((ef) => f.endsWith(ef)));
  } catch {
    console.error("This doesn't look like a git repo (or git isn't available) — falling back isn't implemented. Run `git init` first, or ask me to adapt this script for a plain directory walk.");
    process.exit(1);
  }
}

function replaceCasedMatches(text) {
  let changed = 0;
  const result = text.replace(/wajha/gi, (match) => {
    changed++;
    if (match === match.toLowerCase()) return "shams_elgroub";
    if (match === match.toUpperCase()) return "SHAMS_ELGROUB";
    if (match[0] === match[0].toUpperCase()) return "Shams_Elgroub";
    return "shams_elgroub"; // mixed-case fallback (inside camelCase identifiers)
  });
  return { result, changed };
}

const files = findFiles();
let totalMatches = 0;
let skippedForEnvVar = 0;
const touchedFiles = [];

for (const relPath of files) {
  const fullPath = join(ROOT, relPath);
  let content;
  try {
    content = readFileSync(fullPath, "utf8");
  } catch {
    continue;
  }
  if (!/wajha/i.test(content)) continue;

  const lines = content.split("\n");
  const newLines = lines.map((line) => {
    if (/process\.env\.DDB_|DDB_[A-Z_]*WAJHA/i.test(line)) {
      if (/wajha/i.test(line)) skippedForEnvVar++;
      return line; // leave env-var-name lines untouched — see header comment
    }
    if (!/wajha/i.test(line)) return line;
    const { result, changed } = replaceCasedMatches(line);
    totalMatches += changed;
    return result;
  });

  const newContent = newLines.join("\n");
  if (newContent !== content) {
    touchedFiles.push(relPath);
    if (WRITE) writeFileSync(fullPath, newContent, "utf8");
  }
}

console.log(WRITE ? "*** WRITE MODE ***" : "--- DRY RUN (pass --write to actually rewrite files) ---");
console.log(`\n${touchedFiles.length} file(s) would be changed:`);
touchedFiles.forEach((f) => console.log(`  ${f}`));
console.log(`\n${totalMatches} occurrence(s) renamed.`);
if (skippedForEnvVar > 0) {
  console.log(`\n${skippedForEnvVar} line(s) SKIPPED (contain a process.env.DDB_* reference) — review these manually if you also want them renamed:`);
  console.log(`  grep -rn "process.env.DDB_" backend/src | grep -i wajha`);
}
console.log(
  WRITE
    ? "\nDone. Restart both dev servers, and clear this app's localStorage once (color preferences reset, nothing else affected)."
    : "\nRun again with --write to actually apply these changes."
);
