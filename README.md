# PR Flow Community Agents

Welcome to the **PR Flow Community Store** repository! This is a curated collection of community-contributed Custom Agent Pipelines for PR Flow.

## Browse the Store
To view and install these agents, open the **Community Store** tab inside your PR Flow desktop app, or visit [prflow.app/agents](https://prflow.app/agents).

## Contributing an Agent

We welcome contributions! To submit your own agent config so others can use it:
1. Fork this repository.
2. Create a `.yml` file in the appropriate category under the `agents/` directory (e.g. `agents/frontend/my-agent.yml`).
3. Ensure your YAML matches the [required schema](CONTRIBUTING.md).
4. Open a Pull Request.

Your submission will be validated by our CI and reviewed by maintainers to ensure quality and safety.

## Example Submission
```yaml
metadata:
  title: Design System Enforcer
  description: "Flags raw CSS values in frontend changes and suggests the internal component equivalent."
  tags: ["frontend", "design-system", "react"]
  authors: ["{{authors}}"]
  published_at: "{{published_at}}"

agent:
  id: design-system-enforcer
  name: Design System Enforcer
  trigger: on_pr_draft
  context:
    - diff
  output: findings
  prompt: |
    You are the design-system enforcer...
```

## Anatomy of an agent

An agent declares **when** it runs (`trigger`), **what it may read** (`context`), **what it emits** (`output` — `findings` or `note`), and the `prompt` that drives it. Two kinds of *variables* keep a config short and self-maintaining: **metadata variables** that CI fills from git, and **context variables** that resolve to live PR data at run time — and which of those matter depends on *when* the agent runs.

### Metadata variables — filled by CI

Leave these in the `metadata` block; the publish step fills them from your commit history, so you never hand-maintain them. They don't depend on the trigger.

| Variable | Fills (where) | Resolves to (what) | Use it because (why) |
| --- | --- | --- | --- |
| `{{authors}}` | `metadata.authors` | The file's unique commit authors | Credit tracks git history — no stale hand-typed names, and co-editors are added automatically |
| `{{published_at}}` | `metadata.published_at` | ISO date of the commit that added the file | The store can flag "new" and sort by date without you guessing a value |

Only these two names are valid — a typo like `{{author}}` fails validation instead of shipping a broken value. You can also list explicit authors and add `{{authors}}` to append the git-derived ones.

### Triggers — *when* your agent runs

The trigger is the PR-lifecycle moment PR Flow runs your agent. It sets the timing **and** governs which context is actually meaningful (next table).

| Trigger | Fires when | Best for |
| --- | --- | --- |
| `on_pr_draft` | Each push while the PR is a draft (author-side) | Enforcers/gatekeepers that catch issues before a human reviews |
| `on_review_start` | A reviewer first opens the diff | Context aggregators — cheat sheets, summaries |
| `on_conflict` | The PR becomes merge-conflicting | Conflict-triage notes |
| `manual` | The user clicks **Run** | On-demand or expensive analysis |

### Context variables — *what* your agent can read, grouped by *when*

`context` is an allowlist and the **only** way data reaches the model — the prompt can't reach beyond it, so add the minimum you need (every selector is more data sent to the provider). Any selector works with any trigger, but the marks below show what's *idiomatic* for each moment: review threads don't exist yet at draft time, and history is the whole point of a conflict agent.

| Context variable | Resolves to (what / where) | `on_pr_draft` | `on_review_start` | `on_conflict` | `manual` |
| --- | --- | :---: | :---: | :---: | :---: |
| `diff` | The unified diff | ✅ | ✅ | ✅ | ✅ |
| `pr_meta` | Title, body, file list, open review threads | ⚠️¹ | ✅ | ✅ | ✅ |
| `linked_ticket` | Linked Jira / GitHub / GitLab / Linear / Trello ticket² | ✅ | ✅ | — | ✅ |
| `git_history` | Recent commits touching the changed files | ✅ | ✅ | ⭐ | ✅ |
| `file:<path>` | A repo file at the PR head SHA (e.g. `file:docs/design-system.md`) | ✅ | ✅ | ✅ | ✅ |

✅ available & idiomatic · ⭐ the key selector for this trigger · ⚠️ partial · — rarely useful

> ¹ At draft time there are no reviewers yet, so `pr_meta`'s review-thread section is empty.
> ² Selecting `linked_ticket` sends ticket contents to the model provider — mention it in your PR description.

See [CONTRIBUTING.md](CONTRIBUTING.md) for full guidelines.
