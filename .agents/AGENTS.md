# Community Agents Rules

- All `.yml` agent files must be strictly validated.
- You MUST reference the `schema.json` in the repository root for the exact JSON schema definition of an agent pipeline.
- Whenever you create or modify an agent `.yml` file, you MUST run `pnpm run validate` to ensure it is valid and safe.
- Store new agents in the appropriate category under the `agents/` directory (e.g., `agents/frontend/my-agent.yml`).
