import { parseDocument } from "yaml";
import { error, warn } from "./finding.mjs";

// Security-hardened parse options:
//   - uniqueKeys: reject duplicate mapping keys (a common source of silent overrides)
//   - merge:      disable `<<` merge keys (avoids surprising key injection)
//   - strict:     surface spec violations as errors instead of tolerating them
//   - schema:     "core" allows only JSON-compatible types — no custom/implicit tags
//   - prettyErrors: attach line/column info to diagnostics
const PARSE_OPTIONS = { strict: true, uniqueKeys: true, merge: false, schema: "core", prettyErrors: true };

// Anchors/aliases (`&anchor` / `*ref`) are disabled entirely. They are
// unnecessary for these small configs and are the vector for YAML
// "billion laughs" expansion bombs. The limit is enforced when resolving to JS.
const MAX_ALIAS_COUNT = 0;

const firstLine = (message) => String(message).split("\n")[0].trim();
const lineOf = (item) => item.linePos?.[0]?.line;

/**
 * Securely parse and lint a YAML document.
 * @returns {{ data: object|null, findings: object[] }}
 *   `data` is the parsed value, or null if parsing/linting failed hard.
 */
export function loadYaml(content) {
  let doc;
  try {
    doc = parseDocument(content, PARSE_OPTIONS);
  } catch (e) {
    return { data: null, findings: [error("yaml", `Unable to parse YAML: ${firstLine(e.message)}`)] };
  }

  const findings = [
    ...doc.errors.map((e) => error("yaml", firstLine(e.message), lineOf(e))),
    ...doc.warnings.map((w) => warn("yaml", firstLine(w.message), lineOf(w))),
  ];

  // Hard syntax/lint errors mean we can't trust the tree — stop here.
  if (doc.errors.length > 0) return { data: null, findings };

  try {
    const data = doc.toJS({ maxAliasCount: MAX_ALIAS_COUNT });
    return { data, findings };
  } catch (e) {
    findings.push(error("yaml", `Unsafe YAML: ${firstLine(e.message)} (anchors/aliases are not allowed)`));
    return { data: null, findings };
  }
}
