# Contributing to PR Flow Community Agents

Thank you for contributing! By sharing your agent, you help teams speed up their code reviews.

## Scaffolding a new agent

Using Claude Code in this repo? Run the **`/create-agent`** skill — it interviews you for the fields (category, trigger, context, prompt, …), writes a schema-valid `agents/<category>/<id>.yml`, fills in the metadata variables, and runs the validator for you. Prefer to write the file by hand? Follow the rules below.

## Submission Rules
1. **Allowed Categories**: Your `.yml` file MUST be placed inside one of the allowed category folders:
   - `frontend`
   - `backend`
   - `security`
   - `workflow`
   - `general`
2. **Metadata**: You must include a `metadata` block at the top of the file with `title`, `description`, and `tags`.
   - Leave the `{{authors}}` and `{{published_at}}` variables in place — CI fills them from your commit history. (These are the only supported variables; a typo like `{{author}}` fails validation.)
3. **Uniqueness**: Your `agent.id` and `agent.name` must be unique across the entire store.
4. **Safety**: Every submission is scanned automatically. Hard-coded **secrets** are rejected outright. Prompts that request **dangerous capabilities** (unrestricted shell, filesystem, HTTP, or SQL access) or contain **prompt-injection / jailbreak** language are flagged for mandatory maintainer review before they can be merged.

## What the validator checks
Running `pnpm run validate` (also enforced in CI) will:
- **Fail the build** on: invalid category, YAML syntax/security issues (duplicate keys, disallowed anchors/aliases), schema violations, duplicate `id`/`name`, or a detected secret.
- **Warn** (advisory, surfaced for review) on: dangerous-capability or prompt-injection heuristics, and reliability issues such as an over-long prompt (>10k chars), duplicate instructions, leftover placeholders, undefined `{{variables}}`, or broken Markdown / unclosed code fences.

## Testing Locally
Use Node 22+ (see `.nvmrc`). Before opening a PR, validate your agent locally:
```bash
corepack enable
pnpm install
pnpm run validate
```
