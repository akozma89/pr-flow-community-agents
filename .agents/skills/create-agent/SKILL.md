---
name: create-agent
description: Scaffolds a new PR Flow agent by interviewing the user, generating the YAML, and validating it.
---

# `create-agent` Skill Instructions

1. Interview the user to determine:
   - Category (frontend, backend, security, workflow, general)
   - Agent Name and ID
   - Trigger (e.g., on_pr_draft, on_review_start, manual)
   - Required Context (e.g., diff, pr_meta)
   - Desired Output (findings or note)
   - The prompt instructions
2. Read `schema.json` in the root to understand the valid values.
3. Write the new agent to `agents/<category>/<id>.yml`. Include `{{authors}}` and `{{published_at}}` in the metadata block exactly as written (they are resolved by CI).
4. Run `pnpm run validate` to verify the agent syntax and rules.
