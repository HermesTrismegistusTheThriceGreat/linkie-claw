# Linkie Claw — Production Roadmap Overview

## Current Architecture Snapshot

| Layer | Technology | Status |
|-------|-----------|--------|
| **Frontend** | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, Shadcn UI | ✅ Working prototype |
| **Backend** | Next.js API routes, Zod validation | ✅ Working |
| **Database** | SQLite (`better-sqlite3`) + Drizzle ORM | ⚠️ Single-user, no `user_id` |
| **AI (Text)** | Anthropic Claude (`claude-sonnet-4-20250514`) | ✅ Working |
| **AI (Images)** | Google Gemini Flash / Replicate FLUX Schnell | ✅ Working |
| **Scheduler** | None | ❌ Python scheduler removed, Node.js polling not yet implemented |
| **Publishing** | n8n workflow → LinkedIn API (OAuth 2.0) | ⚠️ Single-user only |
| **Auth** | None | ❌ Not implemented |
| **Deployment** | Local development only | ❌ Not deployed |

---

## Existing Pages & Routes

| Route | Page | Data Source | Status |
|-------|------|-------------|--------|
| `/` | Dashboard | `src/lib/mock-data/stats.ts` (hardcoded) | ⚠️ Mock data |
| `/calendar` | Content Calendar | Real DB via `/api/posts` | ✅ Live |
| `/create` | AI Writer / Studio | Real AI APIs + DB | ✅ Live |
| `/analytics` | Analytics | Sidebar link exists (`disabled: true`) | ❌ Stub |
| `/settings` | Settings | Sidebar link exists (`disabled: true`) | ❌ Stub |

---

## Database Schema (Current — No User Scoping)

**Tables:** `posts`, `generations`

- `posts`: `id`, `title`, `content`, `image_url`, `scheduled_at`, `published_at`, `status`, `linkedin_post_urn`, `error_message`, `created_at`, `updated_at`
- `generations`: `id`, `idea`, `text_variations_json`, `images_json`, `selected_text_id`, `selected_image_id`, `created_at`

> **Critical gap:** No `user_id` column in any table. All data is globally shared.

> **Database-First Approach:** ALL schema changes (auth tables, `user_id` columns, user_settings, linkedin_oauth_states, indexes) are consolidated in Phase 1. The existing `posts` and `generations` tables WORK and will be extended, not replaced. Later phases focus on implementation (queries, routes, UI) — not schema changes.

---

## Roadmap Phase Files

- Phase 0: [00-overview.md](./00-overview.md) (this file)
- Phase 1: [01-database-schema.md](./01-database-schema.md)
- Phase 2: [02-auth.md](./02-auth.md)
- Phase 3: [03-multi-user.md](./03-multi-user.md)
- Phase 4: [04-openclaw-compat.md](./04-openclaw-compat.md)
- Phase 5: [05-settings-page.md](./05-settings-page.md)
- Phase 6: [06-schedule-page.md](./06-schedule-page.md)
- Phase 7: [07-node-scheduler.md](./07-node-scheduler.md)
- Phase 8: [08-dashboard.md](./08-dashboard.md)
- Phase 9: [09-analytics-page.md](./09-analytics-page.md)
- Phase 10: [10-final-polish.md](./10-final-polish.md)
- Phase 11: [11-production-deployment.md](./11-production-deployment.md)

---

## Key Files Map

```
src/
  app/
    page.tsx                → Dashboard (uses mock data)
    calendar/page.tsx       → Calendar (uses real DB)
    create/page.tsx         → AI Writer (uses real AI + DB)
    layout.tsx              → Root layout (no auth wrapper)
    api/
      posts/route.ts        → GET/POST posts
      posts/[id]/route.ts   → GET/PATCH/DELETE single post
      posts/[id]/schedule/  → POST schedule a post
      posts/[id]/unschedule/→ POST unschedule
      generate/text/        → AI text generation
      generate/image/       → AI image generation
      webhooks/publish-status/ → n8n callback
  components/
    layout/sidebar.tsx      → Navigation (Analytics/Settings disabled)
    layout/user-card.tsx    → Hardcoded "Alex Rivera" identity
    dashboard/stats-row.tsx → Uses mock getDashboardStats()
    dashboard/follower-chart.tsx → Uses mockChartHeights
    calendar/calendar-day.tsx → Post cards with hover tooltips
  lib/
    db/schema.ts            → Drizzle schema (posts, generations)
    db/queries.ts           → All DB queries (no user_id filtering)
    mock-data/stats.ts      → Hardcoded stats & charts
    mock-data/posts.ts      → Hardcoded posts & drafts
    mock-data/generations.ts→ Hardcoded AI variations
    queries/stats.ts        → Returns mock data with fake delays
```

---

## Phase Dependency Order

The 11 phases execute in the following sequence:

```mermaid
graph TD
    A["Phase 1: Database Schema"] --> B["Phase 2: Auth"]
    B --> C["Phase 3: Multi-User"]
    C --> D["Phase 4: OpenClaw Compat"]
    C --> E["Phase 5: Settings Page"]
    C --> F["Phase 6: Schedule Page"]
    C --> G["Phase 7: Node.js Scheduler"]
    C --> H["Phase 8: Dashboard"]
    H --> I["Phase 9: Analytics Page"]
    F --> J["Phase 10: Final Polish"]
    G --> J
    H --> J
    I --> J
    J --> K["Phase 11: Production Deployment"]
```

| Phase | Depends On | Why |
|-------|-----------|-----|
| 1. Database Schema | — | Define ALL tables and schema changes upfront (auth, user_id, settings, oauth_states, indexes) |
| 2. Auth | Phase 1 | Implement Auth.js v5 using tables from Phase 1 |
| 3. Multi-User | Phase 2 | Implement queries and middleware using `user_id` columns from Phase 1 |
| 4. OpenClaw Compat | Phase 3 | Needs final page structure to annotate |
| 5. Settings Page | Phase 3 | Implement UI using `user_settings` table from Phase 1 |
| 6. Schedule Page | Phase 3 | Needs user-scoped posts for calendar fixes + edit modal |
| 7. Node.js Scheduler | Phase 3 | Needs user context in scheduler |
| 8. Dashboard | Phase 3 | Needs user context for per-user analytics |
| 9. Analytics Page | Phase 8 | Extends dashboard patterns to dedicated page |
| 10. Final Polish | Phases 6, 7, 8, 9 | Audits everything after all features built |
| 11. Production Deployment | Phase 10 | SQLite→PostgreSQL + deploy + n8n production setup |

---

## Global Technical Decisions

These decisions apply across ALL phases:

### Database Migration: SQLite → PostgreSQL
- **Why:** SQLite is file-based and cannot run on most cloud platforms' serverless functions. PostgreSQL is the standard production database.
- **How:** Rewrite `drizzle.config.ts` to target PostgreSQL, update schema imports from `drizzle-orm/sqlite-core` to `drizzle-orm/pg-core`, use appropriate adapter (`@neondatabase/serverless`, `pg`, or platform-specific).
- **When:** Phase 11 (Production Deployment)
- **Critical:** Development runs on SQLite locally. PostgreSQL migration happens at deployment, not during Phase 1.

### Authentication: Auth.js v5 (NextAuth v5)
- **Why:** Native integration with Next.js App Router, universal `auth()` function, supports Google/GitHub/Email providers, works with SQLite via Drizzle adapter.
- **How:** Install `next-auth@beta`, create `auth.ts` + `auth.config.ts`, use Drizzle adapter with tables defined in Phase 1, wrap layout with `SessionProvider`.
- **When:** Phase 2 (Auth) — schema defined in Phase 1
- **Critical:** Auth runs locally with SQLite. No Vercel deployment in Phase 2.

### LinkedIn OAuth Strategy
- **Decision:** Manual LinkedIn account connection per user via n8n. App-level OAuth flow eliminated.
- **Why:** Simplifies architecture, reduces regulatory burden (no LinkedIn app approval needed), aligns with single-workflow-per-user model.
- **How:** Users manually connect their LinkedIn accounts in n8n. The Next.js app displays connection status in Settings but does not handle OAuth flows.
- **When:** Phase 5 (Settings Page) — display connection status only

### Scheduler Architecture
- **Decision:** Node.js database polling via cron route. Python FastAPI scheduler eliminated.
- **Why:** Eliminates Python dependency, Docker orchestration, and APScheduler complexity. Simpler deployment model.
- **How:** Single API route `/api/cron/publish-scheduled` that polls the `posts` table for `status='scheduled'` and `scheduled_at <= now()`, then triggers n8n workflow.
- **When:** Phase 7 (Node.js Scheduler)
- **Critical:** No external scheduler service (QStash, APScheduler, etc.) required.

### Deployment Platform
- **Decision:** TBD at Phase 11. Options: Railway (everything on one platform), Vercel + Railway, or other.
- **Why:** Platform choice affects database hosting, environment configuration, and n8n hosting strategy.
- **When:** Phase 11 (Production Deployment)

### LinkedIn API Analytics
- **Decision:** Two-tiered implementation. Tier 1 = DB-only analytics (posts created, scheduled, published, failed, success rates). Tier 2 = LinkedIn API analytics (impressions, engagement, followers).
- **Why:** LinkedIn Community Management API scopes (`r_member_postAnalytics`, `r_member_profileAnalytics`) require approval. Build DB analytics first, add LinkedIn API analytics when approved.
- **Action:** Apply for LinkedIn Community Management API access during Phase 2 so approval arrives by Phase 8.
- **When:** Phase 8 (Dashboard) and Phase 9 (Analytics Page)

### Environment Strategy
- **Local dev:** `.env.local` with SQLite + local n8n
- **Production:** Platform environment variables (TBD) with PostgreSQL + cloud n8n
- **Secrets:** `AUTH_SECRET`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `REPLICATE_API_TOKEN`, `N8N_CALLBACK_SECRET`, `DATABASE_URL` (production only)

### n8n Workflow — WORKING SYSTEM, DO NOT MODIFY

> **CRITICAL:** The n8n workflow at `n8n/workflows/linkedin-publish.json` is a **fully functional, production-tested publishing system** inherited from the previous development machine. It handles LinkedIn OAuth, text posts, image upload + posting, and status callbacks. **It works.**

**Rules for all phases:**
1. **Never modify the n8n workflow nodes or logic.** The workflow is correct and was working before the machine migration.
2. **If posting fails, it is a credentials/environment/setup issue — not a code bug.** Common causes: Docker not running, webhook URL mismatch, OAuth tokens expired, `N8N_CALLBACK_SECRET` not matching.
3. **Troubleshoot with the user** before making any changes. Do not attempt to "fix" the workflow unilaterally.

**Troubleshooting checklist (in order):**
1. Is Docker running and is the n8n container up? (`docker ps`)
2. Is `N8N_WEBHOOK_URL` in `.env` correct? (Check for path mismatches — see `.env` notes)
3. Is `N8N_CALLBACK_SECRET` matching between `.env` and the n8n instance?
4. Has the workflow been imported into n8n and **activated** (toggle switch on)?
5. Are LinkedIn OAuth2 credentials configured in n8n UI → Settings → Credentials?
6. Are LinkedIn OAuth tokens still valid?
7. Check n8n execution logs at `http://localhost:5678` for the actual error.

**How the flow works:**
```
User schedules post → Cron picks it up → POST to n8n webhook
→ n8n fetches post data from Next.js API
→ n8n authenticates with LinkedIn (OAuth2 credentials in n8n UI)
→ n8n uploads image (if any) and creates LinkedIn post
→ n8n POSTs callback to /api/webhooks/publish-status with result
→ Next.js updates post status to "published" or "failed"
```

### n8n Hosting
- **Current:** Local Docker Compose (`scheduler/docker-compose.yml`)
- **Production:** Self-hosted on a platform (Railway, Render, DigitalOcean, etc.) with persistent storage, accessed via public URL. The **same workflow file** is re-imported as-is — no modifications needed.
- **Why:** n8n needs to be reachable from LinkedIn OAuth redirects and from Next.js API routes

---

## Conventions for the AI Executor

1. **Always work in feature branches** — never push directly to `main`
2. **Run `npm run typecheck` after every schema/type change** — catch type errors early
3. **Run `npm run lint:fix` before committing** — keep code clean
4. **Test in the browser after every visual change** — verify UI renders correctly
5. **Use `data-testid` attributes** on all interactive elements from Phase 4 onward
6. **Preserve the existing design language** — Aurora backgrounds, glass cards, primary color scheme, Plus Jakarta Sans font
7. **Every API route must validate the authenticated user** from Phase 2 onward
8. **Every DB query must filter by `user_id`** from Phase 3 onward
