# Phase 11: Production Deployment — Go Live

## Goal
Take the fully-built, locally-tested app and deploy it to production. Migrate from SQLite to PostgreSQL, deploy to a hosting platform, configure all production services, and verify end-to-end functionality in production.

## Done When
The app is live on a production URL, both users can sign in and use all features, posts are scheduled and published successfully, and all integrations (auth, n8n, cron, LinkedIn API) work reliably.

## Depends On
Phase 10 (Final Polish)

---

## Deployment Platform Decision

**Status:** TBD — will be decided before this phase begins.

**Options under consideration:**
- **Railway** (everything on one platform: Next.js + n8n + PostgreSQL)
- **Vercel + Railway** (Vercel for Next.js, Railway for n8n + PostgreSQL)
- **Other** (Render, Fly.io, DigitalOcean, etc.)

**Key factors:**
- Cost (target: $20-50/month for 2 users)
- Complexity (fewer platforms = simpler)
- n8n hosting requirements (needs persistent server, not serverless)
- PostgreSQL hosting (ideally on same platform as Next.js)
- Team size (currently 2 users, low traffic expected)

**Decision will be documented here once made.**

---

## Step-by-Step Plan

### 11.1 — Choose Deployment Platform

Evaluate options and make final decision. Document choice in this file.

**Evaluation criteria:**
- [ ] Next.js hosting (supports Node.js runtime for cron endpoint)
- [ ] PostgreSQL database (compatible with Drizzle ORM)
- [ ] n8n hosting (persistent server, public HTTPS URL)
- [ ] Cost estimate for 2 users with ~100 posts/month
- [ ] Ease of environment variable configuration
- [ ] Cron job support (60-second precision or platform-specific cron service)

**Selected platform:** [TO BE FILLED IN]

---

### 11.2 — SQLite → PostgreSQL Migration

#### 11.2.1 — Install PostgreSQL dependencies

```bash
# Option A: If using Neon or Vercel Postgres
npm install @neondatabase/serverless

# Option B: If using standard PostgreSQL
npm install pg
npm install --save-dev @types/pg
```

**Remove SQLite:**
```bash
npm uninstall better-sqlite3 @types/better-sqlite3
```

#### 11.2.2 — Update Drizzle config

Edit `drizzle.config.ts`:

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql", // Changed from "sqlite"
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!, // PostgreSQL connection string
  },
});
```

#### 11.2.3 — Update database schema

Edit `src/lib/db/schema.ts` to change SQLite column types to PostgreSQL:

**Key changes:**
- `text("created_at")` → `timestamp("created_at").defaultNow()`
- `text("scheduled_at")` → `timestamp("scheduled_at")`
- `text("published_at")` → `timestamp("published_at")`
- `integer("boolean_field")` → `boolean("boolean_field")`
- `text("json_field")` → `jsonb("json_field")`

**Example diff:**

```typescript
// BEFORE (SQLite)
export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  user_id: text("user_id").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull(),
  scheduled_at: text("scheduled_at"),
  created_at: text("created_at").notNull(),
});

// AFTER (PostgreSQL)
export const posts = pgTable("posts", {
  id: text("id").primaryKey(),
  user_id: text("user_id").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull(),
  scheduled_at: timestamp("scheduled_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});
```

#### 11.2.4 — Update database client

Edit `src/lib/db/index.ts`:

```typescript
// BEFORE (SQLite)
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";

const sqlite = new Database(process.env.DATABASE_URL || "file:./local.db");
export const db = drizzle(sqlite, { schema });

// AFTER (PostgreSQL with Neon)
import { drizzle } from "drizzle-orm/neon-serverless";
import { neonConfig, Pool } from "@neondatabase/serverless";
import * as schema from "./schema";

neonConfig.fetchConnectionCache = true;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
```

#### 11.2.5 — Generate new migrations

```bash
npm run db:generate
# This creates fresh PostgreSQL migrations in src/lib/db/migrations/
```

#### 11.2.6 — Test migration locally

Set up a local PostgreSQL instance (or use a test database):

```bash
# Option 1: Docker
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres

# Option 2: Install PostgreSQL locally
# (platform-specific)

# Update .env.local for testing
DATABASE_URL=postgresql://postgres:password@localhost:5432/linkie_claw_test

# Run migrations
npm run db:push
```

**Verify:**
- [ ] Tables created successfully
- [ ] Schema matches expectations
- [ ] App starts without errors
- [ ] Can create/read posts

---

### 11.3 — Provision Production Infrastructure

#### 11.3.1 — Create hosting project

- [ ] Create account on chosen platform
- [ ] Create new project and connect GitHub repo
- [ ] Configure build settings (usually auto-detected for Next.js)

#### 11.3.2 — Provision PostgreSQL database

- [ ] Create PostgreSQL database instance
- [ ] Copy `DATABASE_URL` connection string
- [ ] Verify connection string format: `postgresql://user:password@host:port/database?sslmode=require`

#### 11.3.3 — Set up n8n instance

- [ ] Deploy n8n to persistent hosting (Railway, Render, DigitalOcean, etc.)
- [ ] Verify n8n is accessible via HTTPS
- [ ] Copy production n8n webhook URL (e.g., `https://n8n.example.com/webhook/linkedin`)
- [ ] Import workflow from `n8n/workflows/linkedin-publish.json`

---

### 11.4 — Configure Environment Variables in Production

Add all environment variables to the hosting platform's dashboard/CLI:

#### Authentication
```bash
AUTH_SECRET=                       # Generate with: npx auth secret
AUTH_GOOGLE_ID=                    # Google Cloud Console (production redirect URI)
AUTH_GOOGLE_SECRET=                # Google Cloud Console
AUTH_GITHUB_ID=                    # GitHub OAuth App (production redirect URI)
AUTH_GITHUB_SECRET=                # GitHub OAuth App
```

#### Database
```bash
DATABASE_URL=                      # PostgreSQL connection string from platform
```

#### AI APIs
```bash
ANTHROPIC_API_KEY=                 # Rotate from development key
GEMINI_API_KEY=                    # Rotate from development key (if using Gemini)
REPLICATE_API_TOKEN=               # Rotate from development key (if using Replicate)
IMAGE_PROVIDER=gemini              # "gemini" or "replicate"
```

#### LinkedIn OAuth
```bash
LINKEDIN_CLIENT_ID=                # LinkedIn Developer App
LINKEDIN_CLIENT_SECRET=            # LinkedIn Developer App
ENCRYPTION_KEY=                    # Rotate from development key
```

#### n8n Integration
```bash
N8N_WEBHOOK_URL=                   # Production n8n webhook URL
N8N_CALLBACK_SECRET=               # Rotate from development key
```

#### Scheduler
```bash
CRON_SECRET=                       # Generate new with: openssl rand -hex 32
```

#### App URL
```bash
NEXT_PUBLIC_APP_URL=               # Production URL (e.g., https://linkie-claw.example.com)
```

**Important:** Rotate all API keys that were used in development before deploying to production.

---

### 11.5 — Configure OAuth Redirect URIs

Update OAuth applications to allow production redirect URIs.

#### Google OAuth

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Edit OAuth 2.0 Client ID
3. Add Authorized redirect URI:
   ```
   https://{PRODUCTION_URL}/api/auth/callback/google
   ```

#### GitHub OAuth

1. Go to GitHub → Settings → Developer settings → OAuth Apps
2. Edit your OAuth App
3. Update Authorization callback URL:
   ```
   https://{PRODUCTION_URL}/api/auth/callback/github
   ```

#### LinkedIn OAuth (if Phase 8 Tier 2 complete)

1. Go to LinkedIn Developer Portal → Your App → Auth
2. Add Redirect URL:
   ```
   https://{PRODUCTION_URL}/api/linkedin/callback
   ```

---

### 11.6 — Configure Production Cron

The cron endpoint (`/api/cron/publish-scheduled`) must run every 60 seconds to check for scheduled posts.

#### Option A: Platform-specific cron (Vercel)

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/publish-scheduled",
      "schedule": "* * * * *"
    }
  ]
}
```

#### Option B: Railway Cron

Create `.railway/cron.yaml`:

```yaml
cron:
  - schedule: "* * * * *"
    command: "curl -X GET https://{PRODUCTION_URL}/api/cron/publish-scheduled -H 'Authorization: Bearer ${CRON_SECRET}'"
```

#### Option C: External cron service

Use a service like cron-job.org or EasyCron:
- URL: `https://{PRODUCTION_URL}/api/cron/publish-scheduled`
- Method: `GET`
- Schedule: Every 1 minute
- Header: `Authorization: Bearer {CRON_SECRET}`

---

### 11.7 — Deploy n8n to Production

> **CRITICAL — n8n Workflow is a Working System:** The workflow at `n8n/workflows/linkedin-publish.json` was fully functional on the previous development machine. This step **re-deploys the same workflow as-is** to a persistent production host. Do NOT modify the workflow nodes or logic. The only changes are environment-specific: webhook URLs pointing to the production app and fresh LinkedIn OAuth credentials.
>
> **If posting fails after deployment, it is a credentials/setup issue — not a code problem.** Troubleshoot with the user before making any changes. See the troubleshooting checklist in `docs/roadmap/00-overview.md`.

#### 11.7.1 — Deploy n8n instance

Follow platform-specific instructions to deploy n8n with:
- Persistent storage (workflows and credentials survive restarts)
- Public HTTPS URL
- Environment variables configured (especially `N8N_CALLBACK_SECRET` — must match the Next.js app)

#### 11.7.2 — Import workflow (no modifications to workflow logic)

1. Log in to production n8n instance
2. Import the **existing working workflow** from `n8n/workflows/linkedin-publish.json`
3. Update only the environment-specific URLs (these are the only acceptable changes):
   - HTTP Request nodes that call back to the app: Update to `https://{PRODUCTION_URL}/api/webhooks/publish-status`
   - HTTP Request nodes that fetch post data: Update to `https://{PRODUCTION_URL}/api/posts/{postId}`
4. **Do NOT change** the workflow structure, node logic, LinkedIn API calls, or error handling

#### 11.7.3 — Configure LinkedIn OAuth in n8n

1. In n8n, go to Settings → Credentials
2. Add LinkedIn OAuth2 API credentials
3. Use production LinkedIn app credentials
4. Authorize with LinkedIn accounts for both users
5. Verify credentials work by checking the n8n credential test (if available)

#### 11.7.4 — Test n8n webhook

Send a test POST request to verify n8n receives webhooks:

```bash
curl -X POST https://n8n.example.com/webhook/linkedin \
  -H "Content-Type: application/json" \
  -d '{
    "postId": "test",
    "content": "Test post",
    "callbackUrl": "https://{PRODUCTION_URL}/api/webhooks/publish-status",
    "callbackSecret": "{N8N_CALLBACK_SECRET}"
  }'
```

**If this fails, check in order:**
1. Is the n8n instance running and accessible via HTTPS?
2. Is the workflow imported and **activated** (toggle switch)?
3. Does the webhook path in the URL match what the workflow's Webhook node expects?
4. Check n8n execution logs for the actual error.

---

### 11.8 — Deploy Next.js App

#### 11.8.1 — Push to production branch

```bash
# Ensure all changes are committed
git add .
git commit -m "Production deployment configuration"
git push origin main
```

#### 11.8.2 — Trigger deployment

- Platform will automatically detect the push and start building
- Monitor build logs for errors

#### 11.8.3 — Run database migrations

Most platforms auto-run migrations if configured. If manual:

```bash
# SSH into production container or use platform CLI
npm run db:push
```

#### 11.8.4 — Verify build success

Check platform logs to ensure:
- [ ] Build completed successfully
- [ ] No TypeScript errors
- [ ] No missing environment variables
- [ ] App is accessible at production URL

---

### 11.9 — Integration Testing on Production

Test all critical flows in production environment.

#### 11.9.1 — Auth flow

- [ ] Visit production URL
- [ ] Sign in with Google account (User 1)
- [ ] Verify redirect to dashboard
- [ ] Sign out
- [ ] Sign in with GitHub account (User 2)
- [ ] Verify redirect to dashboard

#### 11.9.2 — Post creation and scheduling

For each user:
- [ ] Create a new post
- [ ] Schedule it for 5 minutes in the future
- [ ] Verify post appears in calendar with "scheduled" status
- [ ] Wait for scheduled time
- [ ] Verify cron picks up the post
- [ ] Verify n8n receives webhook
- [ ] Verify n8n publishes to LinkedIn
- [ ] Verify callback updates post status to "published"
- [ ] Verify published post appears on LinkedIn

#### 11.9.3 — Multi-user isolation

- [ ] User 1 creates a post
- [ ] User 2 logs in and does NOT see User 1's post
- [ ] User 2 creates a post
- [ ] User 1 does NOT see User 2's post
- [ ] Dashboard stats are isolated per user

#### 11.9.4 — Dashboard and analytics

For each user:
- [ ] Dashboard loads and shows stats (if LinkedIn connected)
- [ ] Analytics page loads and shows charts (if Tier 2 complete)
- [ ] Settings page shows connection status
- [ ] LinkedIn OAuth flow works (disconnect → reconnect)

---

### 11.10 — Security Checklist

Final security verification before declaring deployment complete.

#### 11.10.1 — API key rotation

- [ ] All development API keys rotated (Anthropic, Gemini, Replicate, etc.)
- [ ] No dev secrets in production environment variables
- [ ] `AUTH_SECRET` generated fresh for production
- [ ] `CRON_SECRET` generated fresh for production
- [ ] `N8N_CALLBACK_SECRET` generated fresh for production
- [ ] `ENCRYPTION_KEY` generated fresh for production

#### 11.10.2 — HTTPS enforcement

- [ ] All pages served over HTTPS
- [ ] No mixed content warnings
- [ ] OAuth redirect URIs use HTTPS
- [ ] n8n webhook URL uses HTTPS

#### 11.10.3 — API endpoint protection

- [ ] `/api/cron/publish-scheduled` rejects requests without valid `CRON_SECRET`
- [ ] `/api/webhooks/publish-status` rejects requests without valid `N8N_CALLBACK_SECRET`
- [ ] All `/api/posts/*` routes require authenticated user
- [ ] All `/api/settings/*` routes require authenticated user
- [ ] All `/api/generate/*` routes require authenticated user

#### 11.10.4 — CORS configuration

- [ ] API routes only accept requests from production domain
- [ ] n8n webhook can reach production app
- [ ] Platform cron service can reach production app

---

## Verification Checklist

- [ ] App deploys successfully to production platform
- [ ] PostgreSQL database accessible from app
- [ ] All environment variables configured correctly
- [ ] Auth flow works with production redirect URIs
- [ ] Two users can sign in independently (Google + GitHub)
- [ ] Each user sees only their own data (multi-user isolation)
- [ ] Post scheduling works (create → schedule → see in calendar)
- [ ] Cron runs reliably every 60 seconds
- [ ] Scheduled posts are picked up and sent to n8n
- [ ] n8n receives webhooks and publishes to LinkedIn
- [ ] n8n callback updates post status correctly
- [ ] Dashboard shows real LinkedIn data (if connected)
- [ ] Analytics page loads (if Phase 8 complete)
- [ ] No SQLite references remain in production code
- [ ] All API keys rotated from development
- [ ] HTTPS enforced on all endpoints
- [ ] OAuth redirect URIs updated for production domain
- [ ] No errors in production logs after 24 hours of operation

---

## Notes

This is a NEW phase that combines database migration, deployment, and production configuration into one "graduation" step.

After this phase completes, the app is **live in production** and ready for real use.

Post-deployment monitoring should track:
- Uptime and availability
- Cron execution reliability
- n8n webhook success rate
- Database query performance
- Error logs for unexpected issues

Consider setting up:
- Uptime monitoring (UptimeRobot, Pingdom, etc.)
- Error tracking (Sentry, LogRocket, etc.)
- Analytics (Vercel Analytics, PostHog, etc.)
