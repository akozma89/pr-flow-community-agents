import { z } from "zod";

export const ALLOWED_CATEGORIES = ["frontend", "backend", "security", "workflow", "general"];

// Template variables a contributor may use in metadata; CI resolves them from git
// history in scripts/build-catalog.js. Written as `{{authors}}` / `{{published_at}}`.
// (Keep in sync with the resolver list in scripts/build-catalog.js.)
export const METADATA_VARIABLES = ["authors", "published_at"];

// ── Client parity ────────────────────────────────────────────────────────────
// These caps mirror what the PR Flow desktop client enforces on install
// (src/main/agentSchema.js). A submission that passes here but exceeds a client
// cap is *uninstallable* — it lists in the store and then fails validation on
// every seat — so this file must never be looser than the client.
//
//   MAX_PROMPT_LENGTH  ↔ agentSchema.MAX_PROMPT_CHARS    (8_000)
//   MAX_FILE_SELECTORS ↔ agentSchema.MAX_FILE_SELECTORS  (5)
//   max_findings max   ↔ agentSchema.MAX_FINDINGS_CAP    (100)
//   paths max          ↔ agentSchema.MAX_PATHS           (20; we stay stricter at 10)
//
// The softer "getting long" threshold is a non-blocking warning in
// checks/quality.mjs — see PROMPT_RELIABILITY_LIMIT there.
const MAX_PROMPT_LENGTH = 8_000;

// `file:<path>` context selectors are capped separately from the total context
// list, matching the client.
const MAX_FILE_SELECTORS = 5;

export const AgentSchema = z.object({
  // The client's authoring form exports documents with a top-level `version: 1`
  // (agentToYaml), and its validator hard-requires it. The community authoring
  // format omits it — the client injects it on install (agentCatalog.toItem) and
  // for vendored defaults (defaultAgents.parseVendored). Accept it either way so
  // a doc exported from the app round-trips into the store unchanged.
  version: z.literal(1).optional(),
  metadata: z.object({
    title: z.string().min(1).max(100),
    description: z.string().min(10).max(500),
    tags: z.array(z.string()).max(5).optional(),
    authors: z.array(z.string()).optional(),
    published_at: z.string().optional(),
  }),
  agent: z.object({
    id: z.string().regex(/^[a-z0-9-]{1,64}$/), // Must be unique across all agents
    name: z.string().max(60),
    trigger: z.enum([
      "on_pr_open",
      "on_pr_draft",
      "on_review_start",
      "on_review_submit",
      "on_conflict",
      "manual",
      "on_demand",
    ]),
    paths: z.array(z.string()).max(10).optional(),
    context: z
      .array(z.string())
      .max(10)
      .refine(
        (sel) => sel.filter((s) => s.startsWith("file:")).length <= MAX_FILE_SELECTORS,
        { message: `At most ${MAX_FILE_SELECTORS} \`file:\` selectors.` },
      )
      .refine((sel) => sel.every((s) => (s.startsWith("file:") ? s.slice(5).trim().length > 0 : true)), {
        message: "A `file:` selector needs a path.",
      }),
    output: z.enum(["findings", "note"]),
    severity_floor: z.enum(["low", "medium", "high", "critical"]).optional(),
    // Optional on purpose: findings are uncapped by default, and omitting this
    // is the right choice unless an agent genuinely needs a narrow budget.
    max_findings: z.number().int().min(1).max(100).optional(),
    prompt: z.string().max(MAX_PROMPT_LENGTH),
  }),
});
