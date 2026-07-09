# Agent schema & validator reference

The authoritative source is `scripts/schema.mjs` (shape) and `scripts/validate.mjs`
(checks). This file summarizes them for the create-agent skill.

## File shape

One agent per file at `agents/<category>/<id>.yml`:

```yaml
metadata:
  title: <string>            # 1–100 chars
  description: <string>      # 10–500 chars
  tags: [<string>, …]        # optional, ≤ 5
  authors: ["{{authors}}"]               # variable — CI backfills from git history
  published_at: "{{published_at}}"       # variable — CI backfills from first commit

agent:
  id: <string>               # ^[a-z0-9-]{1,64}$ — unique across the store
  name: <string>             # ≤ 60 chars — unique across the store
  trigger: <enum>            # on_pr_draft | on_review_start | on_conflict | manual
  paths: [<glob>, …]         # optional, ≤ 10 — run only if the diff touches a match
  context: [<selector>, …]   # required, ≤ 10 — the read allowlist (see below)
  output: <enum>             # findings | note
  severity_floor: <enum>     # optional (findings only): low | medium | high | critical
  max_findings: <int>        # optional, 1–20
  prompt: |                  # required
    <system prompt>
```

## Categories

`frontend`, `backend`, `security`, `workflow`, `general`.

`default/` is **reserved** for PR Flow's first-party built-in prompts (synced into
the app build). It is not community-authorable — the validator skips it — so the
skill must never write there.

## Metadata variables

Contributors leave variables in `metadata` for CI (`scripts/build-catalog.js`) to
fill from git history at publish time. Supported variables:

| Variable | Fills | Resolves to |
| --- | --- | --- |
| `{{authors}}` | `authors` | Unique commit authors who touched the file |
| `{{published_at}}` | `published_at` | ISO date of the commit that added the file |

Only these two names are valid — the validator errors on any other `{{name}}` in
metadata (so a typo like `{{author}}` is caught, not silently shipped). Explicit
values are also fine (e.g. `authors: ["Jane Doe"]`); mix explicit authors with
`{{authors}}` to append the git-derived ones. The legacy `__AUTO_GENERATED__`
sentinel still resolves, but new agents should use the variables.

## Context selectors (the privacy boundary)

Context is the only way data reaches the model; the prompt cannot request more.

| Selector | Resolves to |
| --- | --- |
| `diff` | The unified diff |
| `pr_meta` | Title, body, file list, open review threads |
| `linked_ticket` | Linked Jira/GitHub/GitLab/Linear/Trello ticket(s) |
| `git_history` | Recent commit subjects/authors for the changed files |
| `file:<path>` | A repo file at the PR head SHA, e.g. `file:docs/design-system.md` |

## Prompt length

- Repo schema hard cap: 20,000 chars (absolute safety ceiling — errors above).
- Reliability warning: over 10,000 chars.
- **App install cap: 8,000 chars** — the PR Flow app rejects longer prompts when a
  user installs the agent. Stay well under this; it's the real-world limit.

## Validator: errors vs. warnings

`pnpm run validate` runs the full pipeline. **Errors fail the build; warnings are
advisory** (surfaced for maintainer review, don't block).

**Errors (must fix):**
- Disallowed category / unknown folder.
- YAML problems: syntax errors, duplicate keys, tabs, anchors/aliases (disabled for
  security).
- Schema violations (missing/invalid fields, bad enums, length/count limits).
- Duplicate `id` or `name` anywhere in the store.
- A detected secret/token anywhere in the file.

**Warnings (advisory):**
- Dangerous-capability phrasing (unrestricted shell / filesystem / HTTP / SQL).
- Prompt-injection / jailbreak language.
- Reliability: prompt > 10k chars, duplicate instructions, leftover placeholders
  (`TODO`, `[insert …]`, `__AUTO_GENERATED__` in the prompt body), undefined
  `{{variables}}`, broken Markdown, unclosed code fences.

If a legitimate `security` agent trips a capability/injection warning by
*describing* the thing it detects, that's expected — it's a warning, not a block,
and a maintainer reviews it.
