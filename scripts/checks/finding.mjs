// Shared finding model used by every check module.
//
// A finding is a single issue attributed to one agent file:
//   - level:   "error" fails the build; "warning" is advisory (surfaced, not fatal).
//   - check:   which check produced it (e.g. "yaml", "secrets", "schema").
//   - message: human-readable description.
//   - line:    optional 1-based line in the YAML file, when known.

export const LEVEL = Object.freeze({ ERROR: "error", WARNING: "warning" });

export const error = (check, message, line) => ({ level: LEVEL.ERROR, check, message, line });
export const warn = (check, message, line) => ({ level: LEVEL.WARNING, check, message, line });
