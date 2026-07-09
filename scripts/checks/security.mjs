import { error, warn } from "./finding.mjs";

// Static, heuristic security review of the agent prompt. These checks read
// natural-language *instructions*, so they are intentionally conservative:
//
//   - Prompt-injection / jailbreak language is treated as a WARNING. It is
//     almost never legitimate, but a meta-agent (e.g. an injection detector)
//     may quote such phrases as examples, so we flag rather than hard-fail.
//   - "Dangerous capability" grants are also WARNINGS: the vocabulary overlaps
//     heavily with legitimate security-review agents (which discuss shell, SQL,
//     filesystem, HTTP by design), so a human maintainer makes the final call.
//
// To make any category blocking instead, swap its `warn(...)` for `error(...)`.

// Instructions that try to grant the reviewer capabilities a review agent
// should never need. Patterns favour imperative capability-granting phrasing
// and unambiguous dangerous tokens over bare API-name mentions.
const CAPABILITY_RULES = [
  {
    label: "unrestricted shell execution",
    patterns: [
      /\brm\s+-rf\b/i,
      /\b(?:execute|run|invoke)\b[^.\n]{0,40}\b(?:arbitrary|any|shell|system|terminal)\b[^.\n]{0,20}\bcommands?\b/i,
      /\bshell\s+access\b/i,
      /\b(?:child_process|os\.system|subprocess\.(?:run|call|Popen)|Runtime\.getRuntime)\b/,
    ],
  },
  {
    label: "unrestricted filesystem access",
    patterns: [
      /\b(?:read|write|delete|modify|overwrite|access)\b[^.\n]{0,30}\b(?:any file|arbitrary files?|the (?:entire )?(?:file\s?system|filesystem)|any (?:path|directory))\b/i,
      /(?:\/etc\/(?:passwd|shadow)|~\/\.ssh|\.ssh\/id_[rd]sa|\.aws\/credentials|\bid_rsa\b)/i,
      /\.\.\/\.\.\//, // path traversal
    ],
  },
  {
    label: "unrestricted network / HTTP egress",
    patterns: [
      /\b(?:curl|wget)\s+https?:\/\//i,
      /\b(?:fetch|axios|XMLHttpRequest|requests\.(?:get|post|put))\s*\(/i,
      /\b(?:send|post|upload|transmit|exfiltrate|leak|forward)\b[^.\n]{0,40}\b(?:to\s+)?(?:https?:\/\/|an?\s+(?:external|remote)\s+(?:server|endpoint|url|api|webhook))\b/i,
    ],
  },
  {
    label: "unrestricted SQL execution",
    patterns: [
      /\b(?:DROP\s+(?:TABLE|DATABASE)|TRUNCATE\s+TABLE|DELETE\s+FROM|ALTER\s+TABLE)\b/i,
      /\bUNION\s+SELECT\b|;\s*DROP\b|\bOR\s+1\s*=\s*1\b/i,
      /\b(?:execute|run)\b[^.\n]{0,30}\b(?:arbitrary|any|raw)\s+(?:sql|quer(?:y|ies))\b/i,
    ],
  },
];

// Prompt-injection / jailbreak / instruction-exfiltration patterns.
const INJECTION_RULES = [
  {
    reason: "instruction-override / prompt injection",
    pattern:
      /\b(?:ignore|disregard|forget|override)\b[^.\n]{0,30}\b(?:previous|prior|above|earlier|all)\b[^.\n]{0,30}\b(?:instructions?|prompts?|rules?|context)\b/i,
  },
  {
    reason: "references the system prompt",
    pattern: /\b(?:system prompt|developer message|initial instructions)\b/i,
  },
  {
    reason: "attempts to exfiltrate system instructions",
    pattern:
      /\b(?:reveal|print|repeat|show|expose|dump)\b[^.\n]{0,30}\b(?:your|the)\b[^.\n]{0,20}\b(?:instructions?|system prompt|rules?|configuration)\b/i,
  },
  {
    reason: "jailbreak / restriction-bypass language",
    pattern: /\b(?:jailbreak|DAN mode|do anything now|developer mode|no restrictions|unfiltered|without any restrictions)\b/i,
  },
];

/**
 * @param {string} prompt
 * @returns {object[]} findings
 */
export function checkSecurity(prompt) {
  const findings = [];

  for (const { label, patterns } of CAPABILITY_RULES) {
    if (patterns.some((re) => re.test(prompt))) {
      findings.push(warn("capability", `Prompt appears to grant ${label} — manual review required.`));
    }
  }

  for (const { reason, pattern } of INJECTION_RULES) {
    if (pattern.test(prompt)) {
      findings.push(warn("prompt-security", `Prompt contains ${reason} — manual review required.`));
    }
  }

  return findings;
}
