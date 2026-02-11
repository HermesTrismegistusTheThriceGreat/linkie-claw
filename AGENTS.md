# Linkie Claw — Project Context

## What This Is

AI-powered LinkedIn content studio. Users generate post text (Claude), generate images (Gemini/FLUX), preview how posts look on LinkedIn, schedule them, and auto-publish via n8n workflows.

## Current State

Working local prototype. **Not deployed. No auth. Single-user only.** The production roadmap in `docs/roadmap/` takes it from here to a deployed, multi-user, production-grade app in 10 phases.

**Python scheduler removed.** Scheduling functionality will be replaced with Node.js database polling in Phase 6.

---

## n8n Workflow — WORKING SYSTEM, DO NOT MODIFY

> **CRITICAL:** The n8n workflow at `n8n/workflows/linkedin-publish.json` is a **fully functional, production-tested publishing system** from the previous development machine. It posts to LinkedIn (text and image), handles OAuth, and calls back to the Next.js app with results.

**Rules:**
1. **Never modify the n8n workflow nodes or logic.** The workflow is correct.
2. **If posting fails, it is a credentials/environment setup issue — not a code bug.** Do not attempt to "fix" the workflow.
3. **Troubleshoot with the user** — do not make unilateral changes to n8n configuration.

**If LinkedIn posting is not working, check these in order:**
- [ ] Is Docker running and is the n8n container up? (`docker ps`)
- [ ] Is `N8N_WEBHOOK_URL` in `.env` correct and reachable?
- [ ] Is `N8N_CALLBACK_SECRET` in `.env` matching what n8n expects?
- [ ] Has the workflow been imported into the n8n instance and activated?
- [ ] Are LinkedIn OAuth2 credentials configured in the n8n UI (Settings → Credentials)?
- [ ] Are LinkedIn OAuth tokens still valid (not expired)?

**If all above pass and it still fails → check n8n execution logs in the n8n UI (`http://localhost:5678`) before touching any code.**

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, Shadcn UI |
| Backend | Next.js API routes, Zod validation |
| Database | SQLite (dev) -> PostgreSQL (production, Phase 10) + Drizzle ORM |
| Auth | Auth.js v5 with Drizzle SQLite adapter (Phase 1) |
| AI (Text) | Anthropic Claude (`claude-sonnet-4-20250514`) |
| AI (Images) | Google Gemini Flash / Replicate FLUX Schnell |
| Scheduler | Node.js DB polling cron route (Phase 6) |
| Publishing | n8n workflow -> LinkedIn API (OAuth 2.0) |

## Pages & Routes

| Route | Page | Status |
|-------|------|--------|
| `/` | Dashboard | Mock data |
| `/calendar` | Content Calendar | Live (real DB) |
| `/create` | AI Writer / Studio | Live (real AI + DB) |
| `/analytics` | Analytics | Disabled stub |
| `/settings` | Settings | Disabled stub |

## Database Schema (Current)

Tables: `posts`, `generations`. No `user_id` column — all data is globally shared.

- `posts`: id, title, content, image_url, scheduled_at, published_at, status, linkedin_post_urn, error_message, created_at, updated_at
- `generations`: id, idea, text_variations_json, images_json, selected_text_id, selected_image_id, created_at

## Key Files Map

```
src/
  app/
    page.tsx                  Dashboard (mock data)
    calendar/page.tsx         Calendar (real DB)
    create/page.tsx           AI Writer (real AI + DB)
    layout.tsx                Root layout (no auth wrapper)
    api/
      posts/route.ts          GET/POST posts
      posts/[id]/route.ts     GET/PATCH/DELETE single post
      posts/[id]/schedule/    POST schedule a post
      posts/[id]/unschedule/  POST unschedule
      generate/text/          AI text generation
      generate/image/         AI image generation
      webhooks/publish-status/ n8n callback
  components/
    layout/sidebar.tsx        Navigation (Analytics/Settings disabled)
    layout/user-card.tsx      Hardcoded "Alex Rivera" identity
    dashboard/stats-row.tsx   Uses mock getDashboardStats()
    dashboard/follower-chart.tsx Uses mockChartHeights
    calendar/calendar-day.tsx Post cards with hover tooltips
    studio/                   AI writer components
    ui/                       Shadcn UI primitives
  lib/
    api/anthropic.ts          Claude text generation client
    api/gemini-image.ts       Gemini image generation client
    api/replicate.ts          Replicate FLUX image generation client
    api/image-provider.ts     Image provider factory
    api/scheduler.ts          Scheduler HTTP client
    db/schema.ts              Drizzle schema (posts, generations)
    db/queries.ts             All DB queries (no user_id filtering)
    db/index.ts               DB connection (SQLite)
    mock-data/stats.ts        Hardcoded dashboard stats
    mock-data/posts.ts        Hardcoded posts & drafts
    mock-data/generations.ts  Hardcoded AI variations
    queries/stats.ts          Returns mock data with fake delays
    storage/images.ts         Local image storage
    validations/              Zod request schemas
  types/                      Shared TypeScript interfaces
drizzle/                      Generated migrations
n8n/workflows/
  linkedin-publish.json       LinkedIn publishing workflow (DO NOT MODIFY — working system)
scheduler/
  docker-compose.yml          Docker Compose for n8n + PostgreSQL (scheduler services)
docs/roadmap/                 10-phase production roadmap
docs/PREREQUISITES.md         All API keys, accounts, env vars needed
```

## Conventions

1. Always work in feature branches — never push directly to `main`
2. Run `npm run typecheck` after every schema/type change
3. Run `npm run lint:fix` before committing
4. Test in the browser after every visual change
5. Use `data-testid` attributes on all interactive elements from Phase 3 onward
6. Preserve the existing design language — Aurora backgrounds, glass cards, primary color scheme, Plus Jakarta Sans font
7. Every API route must validate the authenticated user from Phase 1 onward
8. Every DB query must filter by `user_id` from Phase 2 onward

## Production Roadmap — 10 Phases

Detailed implementation docs live in `docs/roadmap/`. Read each phase's doc when you reach it.

| Phase | Doc | Summary | Depends On |
|-------|-----|---------|-----------|
| 1 | `01-auth.md` | Auth.js v5 + SQLite locally (no deployment, no PostgreSQL) | — |
| 2 | `02-multi-user.md` | Add user_id to all tables, scope all queries per user | Phase 1 |
| 3 | `03-openclaw-compat.md` | data-testid attributes, semantic HTML, ARIA | Phase 2 |
| 4 | `04-settings-page.md` | Settings page with profile + preferences + LinkedIn connection status display | Phase 2 |
| 5 | `05-schedule-page.md` | Calendar post rendering fix + post edit modal (moved earlier) | Phase 2 |
| 6 | `06-node-scheduler.md` | Node.js DB polling cron route (replaces Python scheduler) | Phase 2 |
| 7 | `07-dashboard.md` | Two-tiered: DB analytics (Tier 1) + LinkedIn API analytics (Tier 2, requires approval) | Phase 2 |
| 8 | `08-analytics-page.md` | Dedicated analytics page with two-tiered approach | Phase 7 |
| 9 | `09-final-polish.md` | Mock data audit, security hardening, dead code removal | Phases 5, 6, 7, 8 |
| 10 | `10-production-deployment.md` | SQLite→PostgreSQL migration + deploy to platform (TBD) + n8n production + integration testing | Phase 9 |

## Phase Dependency Graph

```
Phase 1 (Auth)
  |
  v
Phase 2 (Multi-User)
  |
  +---> Phase 3 (OpenClaw Compat)
  +---> Phase 4 (Settings Page)
  +---> Phase 5 (Schedule Page)
  +---> Phase 6 (Node.js Scheduler)
  |
  Phase 7 (Dashboard)  -----------+
  Phase 8 (Analytics Page) -------+---> Phase 9 (Final Polish)
                                  |
  Phase 6 (Node.js Scheduler) ----+
  Phase 5 (Schedule Page) --------+
                                  |
                                  v
                           Phase 10 (Production Deployment)
```

Phases 3, 4, 5, 6 can begin in parallel after Phase 2 completes.
Phase 7 depends on Phase 2 (and ideally Phase 4 for settings display).
Phase 8 depends on Phase 7.
Phase 9 depends on Phases 5, 6, 7, 8 all completing.
Phase 10 depends on Phase 9.

## Prerequisites & Environment Variables

See `docs/PREREQUISITES.md` for the complete checklist of API keys, accounts, services, and manual setup steps needed before each phase. The user will provide all required credentials.
