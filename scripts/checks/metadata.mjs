import { error } from "./finding.mjs";
import { METADATA_VARIABLES } from "../schema.mjs";

// Contributors leave `{{authors}}` / `{{published_at}}` for CI to fill from git
// history. A typo like `{{author}}` would pass the schema (it's still a string)
// but never resolve — leaving a literal `{{author}}` in the published catalog.
// Catch unknown variables here so the mistake surfaces at PR time.
const VARIABLE_RE = /\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g;

/**
 * @param {object} metadata
 * @returns {object[]} findings
 */
export function checkMetadataVariables(metadata) {
  const findings = [];
  const known = `known: ${METADATA_VARIABLES.map((v) => `{{${v}}}`).join(", ")}`;

  const scan = (value, field) => {
    if (typeof value !== "string") return;
    for (const [, name] of value.matchAll(VARIABLE_RE)) {
      if (!METADATA_VARIABLES.includes(name)) {
        findings.push(error("metadata", `Unknown variable "{{${name}}}" in metadata.${field} (${known}).`));
      }
    }
  };

  scan(metadata.published_at, "published_at");
  if (Array.isArray(metadata.authors)) {
    for (const author of metadata.authors) scan(author, "authors");
  }

  return findings;
}
