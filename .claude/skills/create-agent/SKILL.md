---
name: create-agent
description: >-
  Scaffold a new PR Flow community agent for this repository. Interactively
  collects the agent's category, metadata, trigger, context selectors, output
  type, and prompt, then generates a schema-valid agents/<category>/<id>.yml and
  runs the repo validator. Use this whenever the user wants to add, create,
  scaffold, author, or contribute a new agent, reviewer, or pipeline agent to the
  pr-flow-community-agents store — or mentions creating a new .yml under agents/,
  or a new design-system/security/workflow reviewer — even if they don't say the
  word "skill" or "YAML".
---

# Create a PR Flow community agent

This skill turns a short interview into a valid agent config committed at
`agents/<category>/<id>.yml`. A community agent is a small, advisory AI reviewer:
it declares *when* it runs (`trigger`), *what it may read* (`context`), *what it
produces* (`output`), and the `prompt` that drives it. The app never lets an agent
write anywhere — output is advisory — so the whole surface is these few fields.

Work in two phases: **interview** the user for the fields, then **generate &
validate**. Don't invent values the user should own (title, prompt, category) —
ask. Do fill in mechanical things (deriving the `id`, choosing sensible defaults)
and say what you chose.

## Phase 1 — Interview

Collect the fields below. Prefer `AskUserQuestion` for the fixed-choice fields
(trigger, output, category, and the yes/no optionals) so the user just picks; ask
the free-text fields (title, description, prompt, file/path globs) in plain
conversation. If the user already gave some of these in their request, skip those
questions and confirm your reading instead of re-asking.

- **category** — the folder the agent lives in. One of: `frontend`, `backend`,
  `security`, `workflow`, `general`. (`AskUserQuestion` caps at 4 options, so offer
  the best-fitting few and let the user pick "Other" for the rest, or just ask
  which of the five fits.) **`default` is reserved** for PR Flow's first-party
  built-in prompts and is not authorable here — never target it.
- **title** — display title, 1–100 chars (e.g. "Design System Enforcer").
- **description** — one sentence, 10–500 chars, what it flags and why.
- **trigger** — when it runs: `on_pr_draft` (each push while draft — author-side
  gatekeeping), `on_review_start` (when a reviewer opens the diff — context/cheat
  sheets), `on_conflict` (merge conflict appears), or `manual` (run button).
- **context** — the allowlist of what the agent may read (the privacy boundary;
  the prompt cannot reach beyond it). Pick from: `diff`, `pr_meta`,
  `linked_ticket`, `git_history`, and `file:<path>` (a repo file at head SHA,
  e.g. `file:docs/design-system.md`). Max 10. `diff` is almost always wanted.
- **output** — `findings` (line-anchored notes with severity — for enforcers) or
  `note` (a markdown blurb — for summaries/cheat sheets).
- **prompt** — the system prompt. See "Writing a good prompt" below.
- Optional: **tags** (≤5), **paths** (globs; run only if the diff touches one,
  e.g. `src/renderer/**`, ≤10), **severity_floor** (`low`/`medium`/`high`/
  `critical`, findings only — drops anything below), **max_findings** (1–20).

Derive `id` as the kebab-case of the title unless the user gives one; it must
match `^[a-z0-9-]{1,64}$` and be unique across the store. `name` defaults to the
title.

## Phase 2 — Generate & validate

1. Write the collected values to a temporary JSON spec (use the scratchpad dir if
   you have one). The shape is documented at the top of
   `scripts/scaffold-agent.mjs`. Include only the fields you have.

2. Run the bundled scaffolder from the repo root:

   ```bash
   node .claude/skills/create-agent/scripts/scaffold-agent.mjs --spec <spec.json>
   ```

   It validates the obvious things (category, enums, id format, uniqueness),
   writes `agents/<category>/<id>.yml` with the prompt as a literal block scalar,
   and sets `authors`/`published_at` to the `{{authors}}` / `{{published_at}}`
   variables (CI backfills them from git history). It refuses to overwrite unless
   you pass `--force`.

3. Run the repo validator — this is the authoritative gate (schema + secret scan +
   security heuristics + reliability warnings):

   ```bash
   pnpm run validate   # or: node scripts/validate.mjs  (needs Node ≥ 22)
   ```

   Errors must be fixed (edit the spec and re-run with `--force`, or edit the YAML
   directly). Warnings are advisory — relay them and fix the easy ones (leftover
   placeholders, an over-long prompt, unclosed code fences). Then show the user the
   created file.

## Writing a good prompt

The prompt is a single system instruction to a review model — no tools, no
network. Write it so it works from the declared `context` alone.

- Be specific about what to flag and what to ignore; tell it to stay quiet when
  there's nothing to say (empty findings beats invented ones).
- If `output` is `findings`, ask for the concrete anchor (path + line) and keep
  each note short and directive.
- **Keep it well under 8000 characters** — that's the hard cap the PR Flow app
  enforces when it installs an agent, even though this repo's own schema is more
  lenient. Shorter prompts are also more reliable.

Avoid things the validator will flag (see `references/schema.md`):
- **Never** paste secrets/tokens — the secret scan blocks the PR outright.
- Avoid instructing shell/filesystem/network/SQL access or "ignore previous
  instructions" style text — agents get no tools, and these trip the security
  heuristics (manual-review flags).

## Reference

Full field constraints, the context-selector vocabulary, and the validator's
error-vs-warning model are in `references/schema.md` — read it if the user asks
about limits, valid values, or why the validator flagged something.

## Example

**User:** "Add a frontend agent that flags inline styles and points people at our
Box component."

After a short interview you'd land on a spec like:

```json
{
  "category": "frontend",
  "title": "Inline Style Blocker",
  "description": "Flags raw inline style props in frontend changes and points to the internal Box component instead.",
  "tags": ["frontend", "design-system", "react"],
  "trigger": "on_pr_draft",
  "paths": ["src/renderer/**"],
  "context": ["diff", "file:docs/design-system.md"],
  "output": "findings",
  "severity_floor": "low",
  "max_findings": 8,
  "prompt": "You are the inline-style blocker. Flag raw `style={{…}}` props and inline CSS in the diff and suggest the internal `<Box>` equivalent, citing docs/design-system.md. Only comment on real violations; if the diff is clean, return no findings."
}
```

→ `node .claude/skills/create-agent/scripts/scaffold-agent.mjs --spec /tmp/spec.json`
→ `pnpm run validate` → `agents/frontend/inline-style-blocker.yml` created and green.
