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

## Conventions

1. **Feature branches only** — never push directly to `main`
2. Run `npm run typecheck` after schema/type changes
3. Run `npm run lint:fix` before committing
4. Run `npm run build` to verify no build failures
5. Use `data-testid` attributes on all interactive elements
6. Preserve design language: Aurora backgrounds, glass cards, Plus Jakarta Sans
7. Every API route must validate the authenticated user session
8. Every DB query must filter by `user_id`
9. File naming: kebab-case (`my-component.tsx`)
10. Types: PascalCase (`Post`, `Generation`), Functions: camelCase

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

## Validation Commands

```bash
npm run typecheck    # TypeScript compilation check
npm run lint:fix     # ESLint with auto-fix
npm run build        # Full Next.js production build
npm run dev          # Dev server on localhost:3000
```

## Current Phase Status

Completed: Phases 1-9, 12 (Auth, Multi-user, Settings, Calendar, Scheduler, Dashboard, Analytics, Voice Tones, Image Styles, Production Image Pipeline/R2)
Remaining: n8n Integration Test (end-to-end publishing verification), Phase 10 (Final Polish), Phase 11 (Production Deployment)

## Agent Teams

This project uses Claude Code Agent Teams for multi-agent implementation.
- Plans: `docs/plans/` — formatted for `/build-with-agent-team`
- Workflow: `/create-plan` (research) → plan document → `/build-with-agent-team` (implementation) → `validator` (testing)
- Use sub-agents for research, agent teams for implementation
