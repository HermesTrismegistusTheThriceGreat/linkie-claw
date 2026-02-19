# Linkie Claw — AI-Powered LinkedIn Content Studio

Generate LinkedIn posts (Claude), create images (Gemini/FLUX), preview, schedule, and auto-publish via n8n workflows.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui |
| Backend | Next.js API routes, Zod validation |
| Database | SQLite (dev) → PostgreSQL (Phase 11) + Drizzle ORM |
| Auth | Auth.js v5 with Drizzle SQLite adapter |
| AI Text | Anthropic Claude (`claude-sonnet-4-20250514`) |
| AI Images | Google Gemini Flash / Replicate FLUX Schnell |
| Publishing | n8n workflow → LinkedIn API (OAuth 2.0) |

## Key File Paths

```
src/app/                        # Next.js routes & pages
src/app/api/                    # API route handlers
src/components/                 # React components (by feature)
src/lib/api/                    # AI provider clients (anthropic, gemini, replicate)
src/lib/db/schema.ts            # Drizzle ORM schema (8 tables)
src/lib/db/queries.ts           # Database query helpers
src/lib/queries/                # Application-level queries
src/lib/validations/            # Zod request schemas
src/lib/auth.ts                 # Auth.js config (Google + GitHub OAuth)
src/lib/voice-tones.ts          # Voice tone definitions & validation
src/types/                      # Shared TypeScript interfaces
src/middleware.ts               # Route protection middleware
drizzle/                        # Database migrations
n8n/workflows/                  # LinkedIn publishing workflow
docs/roadmap/                   # Phase implementation docs
docs/plans/                     # Agent team plan documents
```

## Commands

```bash
npm run dev          # Dev server on localhost:3000
npm run build        # Full Next.js production build
npm run typecheck    # TypeScript compilation check
npm run lint:fix     # ESLint with auto-fix
npm run test         # TBD — test framework not yet configured
npm run db:push      # Push schema changes to database
npm run db:studio    # Open Drizzle Studio (DB browser)
```

---

## How I Want You to Work

### Before Coding
- Ask clarifying questions before starting
- Draft a plan for complex work and confirm before coding
- If unsure, ask — don't assume

### While Coding
- Write complete, working code — no placeholders, no TODOs
- Keep it simple and readable over clever
- Follow existing patterns in the codebase
- One change at a time, verify as you go

### After Coding
- Run `npm run typecheck` and `npm run lint:fix` to verify changes
- Run `npm run build` for anything touching types, routes, or schema
- Summarize what you changed and why

---

## Code Style

- Use ES modules (`import`/`export`) — no CommonJS `require()`
- Functional React components with hooks — no class components
- Type hints on all function parameters and return types
- Descriptive variable names — no single-letter names outside loops
- No commented-out code — delete it or use version control
- File naming: kebab-case (`my-component.tsx`)
- Types: PascalCase (`Post`, `Generation`), Functions: camelCase
- Zod for all request validation, Drizzle ORM for all DB access
- `data-testid` attributes on all interactive elements
- Preserve design language: Aurora backgrounds, glass cards, Plus Jakarta Sans

## Conventions

1. **Direct pushes to `main` are allowed** — use PRs for large changes or team review
2. Every API route must validate the authenticated user session
3. Every DB query must filter by `user_id`
4. Run `typecheck` after schema/type changes
5. Run `lint:fix` before committing
6. Run `build` to verify no build failures

## Do Not

- Leave placeholder code or TODOs in committed code
- Make changes outside the scope of the current task
- Add features, refactor, or "improve" code that wasn't requested
- Assume — ask if unclear
- Add unnecessary error handling for impossible scenarios
- Create abstractions for one-time operations

---

## Verification Loop

After completing a task, verify:
1. `npm run typecheck` — code compiles without errors
2. `npm run lint:fix` — no linting warnings remain
3. `npm run build` — production build succeeds (when applicable)
4. Changes match the original request — no scope creep

If any fail, fix before marking complete.

---

## Quick Commands

Lightweight inline behaviors (not slash skills — those are separate):

**"plan"** — Analyze the task, draft an approach, ask clarifying questions. Don't write code yet.

**"build"** — Implement the plan, run typecheck + lint, verify it works.

**"check"** — Review changes like a skeptical senior dev. Check for bugs, edge cases, and code quality.

**"verify"** — Run typecheck, lint, and build. Summarize results.

**"done"** — Summarize what changed, what was verified, and any notes.

> For heavy-weight multi-agent operations, use slash skills instead: `/create-plan`, `/build-with-agent-team`, `/execute-plan`

---

## Success Criteria

A task is complete when:
- [ ] Code runs without errors
- [ ] `typecheck` passes
- [ ] All tests pass
- [ ] No linting warnings (`lint:fix`)
- [ ] `build` succeeds (when applicable)
- [ ] Feature works as requested
- [ ] Changes are minimal and focused
- [ ] I can understand what changed without explanation

---

## Database Schema (8 tables)

Auth tables: `users`, `accounts`, `sessions`, `verificationTokens`
App tables: `posts` (LinkedIn content), `generations` (AI sessions), `userSettings` (profile + LinkedIn OAuth + voice tones), `linkedinOauthStates`

Key columns on `posts`: status enum `[draft, scheduled, publishing, published, failed]`, `scheduled_at`, `published_at`, `linkedin_post_urn`

## API Routes

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/posts` | GET, POST | List/create posts |
| `/api/posts/[id]` | GET, PUT, DELETE | Single post CRUD |
| `/api/posts/[id]/schedule` | POST | Schedule for publishing |
| `/api/posts/[id]/unschedule` | POST | Remove scheduling |
| `/api/generate/text` | POST | Generate 6 text variations via Claude |
| `/api/generate/image` | POST | Generate images via Gemini/FLUX |
| `/api/dashboard` | GET | Dashboard statistics |
| `/api/analytics` | GET | Analytics data |
| `/api/settings` | GET, PUT | User settings |

## Current Phase Status

Completed: Phases 1-9, 12 (Auth, Multi-user, Settings, Calendar, Scheduler, Dashboard, Analytics, Voice Tones, Image Styles, Production Image Pipeline/R2)
Remaining: n8n Integration Test (end-to-end publishing verification), Phase 10 (Final Polish), Phase 11 (Production Deployment)

## Agent Teams

This project uses Claude Code Agent Teams for multi-agent implementation.
- Plans: `docs/plans/` — formatted for `/build-with-agent-team`
- Workflow: `/create-plan` (research) → plan document → `/build-with-agent-team` (implementation) → `validator` (testing)
- Use sub-agents for research, agent teams for implementation

---

## Notes & Gotchas

### LinkedIn API
- The `commentary` field uses `little` text format — reserved characters MUST be backslash-escaped: `| { } @ [ ] ( ) < > # \ * _ ~`
- Escaping is handled by `escapeForLinkedIn()` in `/api/internal/posts/[id]/route.ts`
- Image posts: `content.media` should only contain `id` (and optional `altText`). Do NOT include `title`.
- API version header: `Linkedin-Version: 202602`
- Full docs: `docs/research/linkedin-api-character-rules.md`

### n8n Workflows
- Middleware at `src/middleware.ts` must allow `/uploads/`, `/api/internal/`, `/api/cron/`, `/api/webhooks/` without auth
- Updating workflow code via API requires deactivate → activate cycle (POST `/deactivate` then `/activate` with `versionId`)
- Expression nodes use `.first().json` (not `.item.json`) to avoid item linking failures through binary nodes
- n8n execution data uses "flatted" JSON format — parse with index-based dereferencing

### Testing
- No test framework configured yet — `npm run test` is a placeholder for future setup
