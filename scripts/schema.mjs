import { z } from "zod";

export const ALLOWED_CATEGORIES = ["frontend", "backend", "security", "workflow", "general"];

// Template variables a contributor may use in metadata; CI resolves them from git
// history in scripts/build-catalog.js. Written as `{{authors}}` / `{{published_at}}`.
// (Keep in sync with the resolver list in scripts/build-catalog.js.)
export const METADATA_VARIABLES = ["authors", "published_at"];

// Absolute ceiling for a prompt. This is a hard safety cap so a pathologically
// large prompt can't be fed through the downstream analyzers (regex/markdownlint).
// The softer 10k "reliability" threshold is a non-blocking warning in
// checks/quality.mjs — see PROMPT_RELIABILITY_LIMIT there.
const MAX_PROMPT_LENGTH = 20_000;

export const AgentSchema = z.object({
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
    context: z.array(z.string()).max(10),
    output: z.enum(["findings", "note"]),
    severity_floor: z.enum(["low", "medium", "high", "critical"]).optional(),
    max_findings: z.number().int().min(1).max(20).optional(),
    prompt: z.string().max(MAX_PROMPT_LENGTH),
  }),
});
