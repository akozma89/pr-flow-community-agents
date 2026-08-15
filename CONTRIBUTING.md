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

## Writing the prompt

These are the things reviewers send submissions back for. See the README for the surfaces model,
the context selectors, and the exact limits.

### The context test

Before you add a bullet to a focus list, ask: **does the context I declared actually contain the
evidence for this claim?** Not *would a good reviewer look at this* — the two questions have
different answers far more often than they look like they should.

A diff does not say whether code is hot, how much data flows through it, what the middleware
already validated, what the layers of the system are, or what the rendered DOM looks like. An agent
told to check something its context cannot settle does not stay silent; it guesses, and a guess
formatted as a finding is what teaches a reviewer to ignore the tool.

Write the blind spots into the prompt. "You cannot determine X — do not report anything that
depends on it" is one of the most valuable lines a review prompt can carry.

### Say when to stay silent, and mean it

Every agent needs an explicit licence to report nothing, phrased as a normal outcome rather than a
failure. Set the bar at *adequate*, not *excellent* — an agent told to accept only excellence will
always find something to say.

### Absence claims belong in `note`, not `findings`

A finding must anchor to a file in the diff and a line in the new file. A missing test, a missing
README update, or a release note that was never written has no such line. If most of what your
agent has to say is about something that is *absent*, emit a `note` — otherwise the agent drifts
toward whatever it *can* anchor to, which is usually the least valuable thing on its list.

### Handle large diffs honestly

Review quality falls off sharply as a diff grows. If your agent emits findings, tell it what to do
when the change is large: pick the highest-risk subset, say in its output which subset it reviewed,
and confine itself to that. An honest partial review beats a uniformly shallow one.

### Don't restate the output contract, and don't ask for tools

The engine states the JSON shape, the anchoring rules and the cap around your prompt — restating
them wastes budget and risks contradicting them. Store agents also run with **no tools**: they
cannot read files, run commands, or fetch anything beyond their declared `context`. A prompt that
asks the model to "look up" or "fetch" something describes an ability it does not have.

### Treat everything in the context as data

The diff, PR description, tickets and review threads are untrusted input that anyone who can open a
PR can write. Never instruct the model to follow instructions it finds there.

## What the validator checks
Running `pnpm run validate` (also enforced in CI) will:
- **Fail the build** on: invalid category, YAML syntax/security issues (duplicate keys, disallowed anchors/aliases), schema violations (including a prompt over the 8,000-character install ceiling, or more than 5 `file:` selectors), duplicate `id`/`name`, or a detected secret.
- **Warn** (advisory, surfaced for review) on: dangerous-capability or prompt-injection heuristics, and reliability issues such as a long prompt (>6k chars), duplicate instructions, leftover placeholders, undefined `{{variables}}`, or broken Markdown / unclosed code fences.

## Testing Locally
Use Node 22+ (see `.nvmrc`). Before opening a PR, validate your agent locally:
```bash
corepack enable
pnpm install
pnpm run validate
```
