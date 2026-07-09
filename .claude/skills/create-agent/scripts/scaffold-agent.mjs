#!/usr/bin/env node
// Deterministically write a community-agent YAML from a JSON spec.
//
// Usage:
//   node .claude/skills/create-agent/scripts/scaffold-agent.mjs --spec <spec.json> [--force]
//
// The spec is produced by the create-agent skill after interviewing the user.
// This script only *writes* well-formed YAML (the fiddly part is the prompt
// block scalar); the authoritative checks — schema, secrets, security, quality —
// are the repo's own validator, which the skill runs afterwards.
//
// Spec shape:
//   {
//     "category": "frontend",              // one of ALLOWED_CATEGORIES
//     "title": "Design System Enforcer",
//     "description": "…10-500 chars…",
//     "tags": ["frontend", "react"],        // optional, ≤ 5
//     "id": "design-system-enforcer",       // optional; derived from title if omitted
//     "name": "Design System Enforcer",     // optional; defaults to title (≤ 60 chars)
//     "trigger": "on_pr_draft",             // on_pr_draft | on_review_start | on_conflict | manual
//     "paths": ["src/renderer/**"],          // optional, ≤ 10
//     "context": ["diff", "file:docs/x.md"], // required, ≤ 10
//     "output": "findings",                 // findings | note
//     "severity_floor": "medium",           // optional (findings only)
//     "max_findings": 8,                    // optional, 1-20
//     "prompt": "You are …"                 // required
//   }

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Keep in sync with scripts/schema.mjs (the authoritative validator). Duplicated
// here so the scaffolder can fail fast with a friendly message before writing.
const ALLOWED_CATEGORIES = ["frontend", "backend", "security", "workflow", "general"];
const RESERVED_DIRS = ["default"]; // first-party; not community-authorable
const TRIGGERS = ["on_pr_draft", "on_review_start", "on_conflict", "manual"];
const OUTPUTS = ["findings", "note"];
const SEVERITIES = ["low", "medium", "high", "critical"];
const ID_RE = /^[a-z0-9-]{1,64}$/;

// The repo root is four levels up from this script (.claude/skills/create-agent/scripts/).
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const AGENTS_DIR = path.join(REPO_ROOT, "agents");

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { force: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--spec") args.spec = argv[++i];
    else if (argv[i] === "--force") args.force = true;
    else if (!args.spec) args.spec = argv[i]; // positional spec path
  }
  return args;
}

const kebab = (s) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

// A safe single-line YAML scalar. YAML double-quoted scalars accept JSON escapes,
// so JSON.stringify yields a valid, correctly-escaped scalar for any string.
const scalar = (s) => JSON.stringify(String(s));

// Emit a multi-line prompt as a literal block scalar (`|`), indented 4 spaces.
const promptBlock = (prompt) =>
  String(prompt)
    .replace(/\r\n/g, "\n")
    .replace(/\n+$/, "") // block `|` re-adds a single trailing newline
    .split("\n")
    .map((line) => (line.length ? `    ${line}` : ""))
    .join("\n");

// Best-effort scan of existing community agents for id/name collisions. Skips the
// reserved first-party dirs. Falls back silently if the yaml dep can't be loaded —
// the repo validator is the real uniqueness gate.
async function existingIdsAndNames() {
  const ids = new Map();
  const names = new Map();
  let parse;
  try {
    ({ parse } = await import("yaml"));
  } catch {
    return { ids, names, checked: false };
  }
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!RESERVED_DIRS.includes(e.name)) walk(full);
      } else if (/\.ya?ml$/i.test(e.name)) {
        try {
          const doc = parse(fs.readFileSync(full, "utf8"));
          const rel = path.relative(REPO_ROOT, full);
          if (doc?.agent?.id) ids.set(doc.agent.id, rel);
          if (doc?.agent?.name) names.set(doc.agent.name, rel);
        } catch {
          /* ignore unparseable files here; validator will report them */
        }
      }
    }
  };
  walk(AGENTS_DIR);
  return { ids, names, checked: true };
}

function buildYaml(spec, id, name) {
  const m = ["metadata:", `  title: ${scalar(spec.title)}`, `  description: ${scalar(spec.description)}`];
  if (spec.tags?.length) m.push(`  tags: [${spec.tags.map(scalar).join(", ")}]`);
  // Variables filled from git history by scripts/build-catalog.js.
  m.push(`  authors: ["{{authors}}"]`, `  published_at: "{{published_at}}"`);

  const a = ["agent:", `  id: ${id}`, `  name: ${scalar(name)}`, `  trigger: ${spec.trigger}`];
  if (spec.paths?.length) {
    a.push("  paths:");
    for (const p of spec.paths) a.push(`    - ${scalar(p)}`);
  }
  a.push("  context:");
  for (const c of spec.context) a.push(`    - ${scalar(c)}`);
  a.push(`  output: ${spec.output}`);
  if (spec.severity_floor) a.push(`  severity_floor: ${spec.severity_floor}`);
  if (spec.max_findings != null) a.push(`  max_findings: ${spec.max_findings}`);
  a.push("  prompt: |", promptBlock(spec.prompt));

  return `${m.join("\n")}\n\n${a.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.spec) die("no spec provided. Use --spec <path-to-spec.json>.");
  if (!fs.existsSync(args.spec)) die(`spec file not found: ${args.spec}`);

  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(args.spec, "utf8"));
  } catch (e) {
    die(`spec is not valid JSON: ${e.message}`);
  }

  // ── Guards (friendly, pre-write) ──────────────────────────────────────────
  if (RESERVED_DIRS.includes(spec.category)) {
    die(`"${spec.category}" is reserved for first-party defaults and is not community-authorable.`);
  }
  if (!ALLOWED_CATEGORIES.includes(spec.category)) {
    die(`category "${spec.category}" is not allowed. Choose one of: ${ALLOWED_CATEGORIES.join(", ")}.`);
  }
  for (const field of ["title", "description", "trigger", "context", "output", "prompt"]) {
    if (spec[field] == null || (Array.isArray(spec[field]) ? spec[field].length === 0 : String(spec[field]).trim() === "")) {
      die(`missing required field: ${field}`);
    }
  }
  if (!TRIGGERS.includes(spec.trigger)) die(`trigger "${spec.trigger}" is invalid. Use one of: ${TRIGGERS.join(", ")}.`);
  if (!OUTPUTS.includes(spec.output)) die(`output "${spec.output}" is invalid. Use one of: ${OUTPUTS.join(", ")}.`);
  if (spec.severity_floor && !SEVERITIES.includes(spec.severity_floor)) {
    die(`severity_floor "${spec.severity_floor}" is invalid. Use one of: ${SEVERITIES.join(", ")}.`);
  }

  const id = spec.id ? String(spec.id) : kebab(spec.title);
  const name = spec.name ? String(spec.name) : spec.title;
  if (!ID_RE.test(id)) die(`id "${id}" is invalid. Must match ${ID_RE} (lowercase letters, digits, hyphens; ≤ 64 chars).`);
  if (String(name).length > 60) die(`name "${name}" exceeds 60 characters.`);

  const { ids, names, checked } = await existingIdsAndNames();
  if (checked) {
    if (ids.has(id)) die(`id "${id}" is already used by ${ids.get(id)}.`);
    if (names.has(name)) die(`name "${name}" is already used by ${names.get(name)}.`);
  }

  const outDir = path.join(AGENTS_DIR, spec.category);
  const outPath = path.join(outDir, `${id}.yml`);
  if (fs.existsSync(outPath) && !args.force) {
    die(`${path.relative(REPO_ROOT, outPath)} already exists. Pass --force to overwrite.`);
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, buildYaml(spec, id, name));

  const rel = path.relative(REPO_ROOT, outPath);
  console.log(`✓ wrote ${rel}`);
  console.log(`  id: ${id}   name: ${name}   trigger: ${spec.trigger}   output: ${spec.output}`);
  console.log(`\nNext: run the validator — \`pnpm run validate\` (or \`node scripts/validate.mjs\`).`);
}

main().catch((e) => die(e.message));
