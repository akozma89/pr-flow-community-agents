import { lint } from "markdownlint/sync";
import { warn } from "./finding.mjs";

// Quality checks are about *reliability*, not security, so every finding here is
// a non-blocking warning.

// Soft cap — an early warning that a prompt is approaching the hard ceiling.
// The hard cap lives in schema.mjs (MAX_PROMPT_LENGTH = 8_000), which mirrors
// what the desktop client accepts on install; past that a submission is
// uninstallable, not merely unreliable. Warn well before it, since prompts also
// tend to lose reliability as they grow.
const PROMPT_RELIABILITY_LIMIT = 6_000;

// Curated markdownlint rules: structural issues only. Every prose/style rule is
// disabled so free-form prompt text does not generate noise.
//   MD011 reversed link syntax   MD038 spaces in code span
//   MD039 spaces in link text    MD042 empty links
const MARKDOWNLINT_CONFIG = { default: false, MD011: true, MD038: true, MD039: true, MD042: true };

// Leftover authoring artifacts that should never ship in a published prompt.
const PLACEHOLDER_PATTERNS = [
  /__AUTO_GENERATED__/,
  /\b(?:TODO|FIXME|TBD|XXX)\b/,
  /\blorem ipsum\b/i,
  /\[(?:insert|your|placeholder|todo)\b[^\]]*\]/i, // [insert X], [your Y here]
  /<(?:insert|placeholder|your)\b[^>]*>/i, // <placeholder>
];

const truncate = (s, n = 80) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * @param {string} prompt
 * @returns {object[]} findings (all warnings)
 */
export function checkQuality(prompt) {
  return [
    ...checkLength(prompt),
    ...checkDuplicateInstructions(prompt),
    ...checkPlaceholders(prompt),
    ...checkTemplateVariables(prompt),
    ...checkMarkdown(prompt),
  ];
}

function checkLength(prompt) {
  if (prompt.length <= PROMPT_RELIABILITY_LIMIT) return [];
  return [
    warn(
      "quality",
      `Prompt is ${prompt.length} characters (recommended max ${PROMPT_RELIABILITY_LIMIT}, hard install ceiling 8,000); long prompts degrade reliability and risk rejection on install.`,
    ),
  ];
}

function checkDuplicateInstructions(prompt) {
  const seen = new Set();
  const duplicates = new Set();

  // Candidate "instructions": lines and sentence-ish segments that are long
  // enough to be meaningful (avoids flagging short bullets / blank lines).
  const segments = prompt
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20 && s.split(/\s+/).length >= 4);

  for (const segment of segments) {
    const key = segment.toLowerCase().replace(/\s+/g, " ").replace(/[.!?]+$/, "");
    if (seen.has(key)) duplicates.add(segment);
    else seen.add(key);
  }

  return [...duplicates].map((s) => warn("quality", `Duplicate instruction: "${truncate(s)}"`));
}

function checkPlaceholders(prompt) {
  const findings = [];
  for (const re of PLACEHOLDER_PATTERNS) {
    const match = prompt.match(re);
    if (match) {
      findings.push(warn("quality", `Contains placeholder text "${truncate(match[0])}" — replace before publishing.`));
    }
  }
  return findings;
}

function checkTemplateVariables(prompt) {
  const findings = [];

  // Undefined mustache-style variables, e.g. {{foo}}. Restricted to a bare
  // identifier so JSX like `style={{ padding: 8 }}` is not misflagged.
  const variables = new Set();
  for (const [, name] of prompt.matchAll(/\{\{\s*([a-zA-Z_][\w.]*)\s*\}\}/g)) variables.add(name);
  for (const name of variables) {
    findings.push(warn("quality", `Undefined template variable "{{${name}}}" — PR Flow does not interpolate prompt variables.`));
  }

  if (/\{\{\s*\}\}/.test(prompt)) findings.push(warn("quality", 'Empty placeholder "{{}}" found.'));

  return findings;
}

function checkMarkdown(prompt) {
  const findings = [];

  // Unbalanced fenced code blocks — markdownlint does not detect these, so we
  // count fence markers directly. An odd count means one is never closed.
  const fenceCount = (prompt.match(/^[ \t]{0,3}(?:```+|~~~+)/gm) || []).length;
  if (fenceCount % 2 !== 0) {
    findings.push(warn("quality", "Unclosed code fence: an opening ``` / ~~~ has no matching close."));
  }

  const results = lint({ strings: { prompt }, config: MARKDOWNLINT_CONFIG });
  for (const issue of results.prompt || []) {
    const detail = issue.errorDetail ? ` (${issue.errorDetail})` : "";
    findings.push(warn("quality", `Markdown: ${issue.ruleDescription}${detail}`, issue.lineNumber));
  }

  return findings;
}
