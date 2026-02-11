# Kickoff Prompt for Kimmy

## How to Use

Paste the prompt below into a new Claude Code session from the project root (`C:\Users\seage\Desktop\linkie-claw`). Claude will pick up `AGENTS.md` automatically from the repo root.

---

## Prompt

```
You are executing the Linkie Claw production roadmap — taking this app from a working local prototype to a deployed, multi-user, production-grade LinkedIn content studio.

## Your references

- `AGENTS.md` — project context, tech stack, file map, conventions (already in your context)
- `docs/roadmap/00-overview.md` — architecture snapshot, dependency graph, key decisions
- `docs/roadmap/01-database-schema.md` through `11-production-deployment.md` — detailed phase instructions
- `docs/PREREQUISITES.md` — env vars, API keys, and manual setup steps needed per phase

Read `docs/roadmap/00-overview.md` and `docs/PREREQUISITES.md` now to orient yourself.

## Execution protocol

Work through 11 phases in dependency order. For each phase:

1. **Read** the phase doc (`docs/roadmap/XX-*.md`) — it contains everything: tasks, files to touch, acceptance criteria
2. **Ask me** for anything you need before starting (API keys, account setup, decisions) — never guess credentials
3. **Branch** — create `phase-XX-description` off the current branch
4. **Build** — implement the phase. Parallelize independent sub-steps where the doc structure allows
5. **Verify** — `npm run typecheck && npm run lint:fix && npm run build`, then walk the phase's checklist
6. **Commit & report** — checkpoint on the branch, summarize what shipped and any decisions made, then **wait for my go-ahead** before starting the next phase

After Phase 3 (multi-user), Phases 4–8 can run in parallel per the dependency graph in the overview doc.

## Hard rules

- **n8n workflow is sacred** — never modify `n8n/workflows/linkedin-publish.json`. If publishing fails, troubleshoot credentials/environment with me.
- **Feature branches only** — never commit directly to main.
- **Ask, don't assume** — if a phase needs something I haven't provided, stop and ask.
- **No over-engineering** — implement exactly what the phase doc specifies. No extra abstractions, helpers, or "nice to haves" beyond scope.

## Start

Read Phase 1 (`docs/roadmap/01-database-schema.md`) and `docs/PREREQUISITES.md`. Tell me what you need from me before you begin.
```
