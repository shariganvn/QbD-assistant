# Agent Baton Consumer Bootstrap

Date: 2026-07-20

## Adoption boundary

- Adopt the pipx-installed `baton` CLI for session state, handoff reconciliation, test evidence, and the Claude Code SessionStart gate.
- Keep the repository's existing `CLAUDE.md`, rules, hooks, and JavaScript workflow-artifact gate unchanged.
- Keep `plans/**` trackable. The current `.gitignore` does not exclude plans, so generated reports remain visible to Git.
- Keep consumer runtime code language-clean: agent-baton contributes no repository-local Python files, virtual environment, or requirements file.

## Local state policy

`project-state.yaml`, `session-handoff.yaml`, `docs/.session-state.md`, and `artifacts/` are local generated state. They are ignored by Git and recreated or refreshed through the installed CLI.
