import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { AgentSchema, ALLOWED_CATEGORIES } from "./schema.mjs";
import { LEVEL, error } from "./checks/finding.mjs";
import { loadYaml } from "./checks/yaml.mjs";
import { createSecretScanner } from "./checks/secrets.mjs";
import { checkSecurity } from "./checks/security.mjs";
import { checkQuality } from "./checks/quality.mjs";
import { checkMetadataVariables } from "./checks/metadata.mjs";

// Validation pipeline for community agent configs. For each `agents/**/*.yml`:
//   1. category   — folder must be an allowed category
//   2. yaml       — secure parse + lint (checks/yaml.mjs)
//   3. schema     — shape validation (schema.mjs)
//   4. uniqueness — id / name unique across the whole store
//   5. secrets    — secretlint scan of the raw file (checks/secrets.mjs)
//   6. security   — prompt-injection + dangerous-capability heuristics
//   7. quality    — reliability warnings (length, dupes, placeholders, markdown)
//
// Errors fail the build; warnings are advisory and surfaced for maintainer review.

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const AGENTS_DIR = path.join(ROOT, "agents");

// First-party directories maintained by PR Flow itself (the built-in default
// prompts synced into the app build). They are not community-editable, so the
// validator skips them entirely rather than treating them as a category.
const RESERVED_DIRS = new Set(["default"]);

function collectAgentFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (RESERVED_DIRS.has(entry.name)) continue;
      files.push(...collectAgentFiles(full));
    } else if (/\.ya?ml$/i.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

async function inspectFile(file, scanSecrets, registry) {
  const relToRoot = path.relative(ROOT, file);
  const findings = [];

  const category = path.relative(AGENTS_DIR, file).split(path.sep)[0];
  if (!ALLOWED_CATEGORIES.includes(category)) {
    findings.push(error("category", `Category "${category}" is not allowed. Use one of: ${ALLOWED_CATEGORIES.join(", ")}.`));
  }

  const content = fs.readFileSync(file, "utf8");
  const { data, findings: yamlFindings } = loadYaml(content);
  findings.push(...yamlFindings);

  if (data) {
    const parsed = AgentSchema.safeParse(data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        findings.push(error("schema", `[${issue.path.join(".") || "root"}] ${issue.message}`));
      }
    } else {
      const { id, name, prompt } = parsed.data.agent;

      if (registry.ids.has(id)) findings.push(error("uniqueness", `Duplicate agent id "${id}" (already used by ${registry.ids.get(id)}).`));
      else registry.ids.set(id, relToRoot);

      if (registry.names.has(name)) findings.push(error("uniqueness", `Duplicate agent name "${name}" (already used by ${registry.names.get(name)}).`));
      else registry.names.set(name, relToRoot);

      findings.push(...checkMetadataVariables(parsed.data.metadata));

      // Scan the whole file — secrets can hide in metadata, not just the prompt.
      findings.push(...(await scanSecrets(content, relToRoot)));
      findings.push(...checkSecurity(prompt));
      findings.push(...checkQuality(prompt));
    }
  }

  return { file: relToRoot, findings };
}

function report(results, fileCount) {
  let errors = 0;
  let warnings = 0;

  for (const { file, findings } of results) {
    if (findings.length === 0) {
      console.log(`✅ ${file}`);
      continue;
    }
    const hasError = findings.some((f) => f.level === LEVEL.ERROR);
    console.log(`${hasError ? "❌" : "⚠️ "} ${file}`);
    for (const f of findings) {
      if (f.level === LEVEL.ERROR) errors++;
      else warnings++;
      const mark = f.level === LEVEL.ERROR ? "✗" : "•";
      const loc = f.line ? ` (line ${f.line})` : "";
      console.log(`   ${mark} [${f.check}]${loc} ${f.message}`);
    }
  }

  console.log(`\nValidated ${fileCount} agent file(s): ${errors} error(s), ${warnings} warning(s).`);
  if (warnings > 0) console.log("⚠️  Warnings are advisory (reliability / manual-review flags) and do not fail the build.");

  if (errors > 0) {
    console.log("💥 Validation failed. Please fix the errors above.");
    process.exit(1);
  }
  console.log("✅ Validation passed.");
}

async function main() {
  // Sort for deterministic output and stable duplicate-attribution across runs.
  const files = collectAgentFiles(AGENTS_DIR).sort();
  const scanSecrets = await createSecretScanner();
  const registry = { ids: new Map(), names: new Map() };

  const results = [];
  for (const file of files) {
    results.push(await inspectFile(file, scanSecrets, registry));
  }

  report(results, files.length);
}

main().catch((e) => {
  console.error("Unexpected validator failure:", e);
  process.exit(1);
});
