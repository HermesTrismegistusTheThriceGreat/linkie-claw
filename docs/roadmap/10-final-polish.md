# Phase 10: Final Polish — Production Readiness Audit

## Goal
Audit entire codebase for remaining mock data, hardcoded values, disabled features, and rough edges. Ensure everything is production-ready before deployment.

## Done When
Zero mock data remains in production paths, all pages use live data, security is hardened, type safety is verified, and the app passes a final production readiness review.

## Depends On
Phases 6, 7, 8, 9 (all feature work complete)

---

## Step-by-Step Plan

### 10.1 — Mock Data Audit

Search and eliminate every instance of mock/hardcoded data from production code paths.

#### Files to audit:

| File | Mock Data | Action |
|------|----------|--------|
| `src/lib/mock-data/stats.ts` | Dashboard stats (reach, engagement, followers) | **Delete file** if Phase 8 complete |
| `src/lib/mock-data/posts.ts` | Sample posts and drafts | Keep for dev seeding, ensure not imported in production code |
| `src/lib/mock-data/generations.ts` | AI generation mock sessions | Keep for dev seeding, ensure not imported in production code |
| `src/lib/queries/stats.ts` | Returns mock data with fake delays | **Delete** or ensure redirects to real LinkedIn API |
| `src/components/layout/user-card.tsx` | Hardcoded "Alex Rivera" | **Verify** replaced with session data from Phase 1 |
| `src/components/dashboard/follower-chart.tsx` | `mockChartHeights` array | **Verify** replaced with real data from Phase 8 |
| `src/components/dashboard/stats-row.tsx` | Calls mock `getDashboardStats()` | **Verify** replaced with real data from Phase 8 |

#### Search commands:

```bash
# Find all imports of mock data in non-test files
grep -r "mock-data" src/ --include="*.ts" --include="*.tsx" | grep -v ".test." | grep -v "node_modules"

# Find hardcoded sample data
grep -r "Alex Rivera" src/
grep -r "mockChartHeights" src/
grep -r "samplePosts" src/
grep -r "sampleDrafts" src/
grep -r "mockStats" src/
```

#### Action items:
- [ ] Remove all `mock-data` imports from production code paths
- [ ] Remove hardcoded user names/emails/avatars
- [ ] Verify all dashboard components use real LinkedIn API data
- [ ] Ensure mock data files are only used in development seeding scripts

---

### 10.2 — Dead Code Removal

Remove unused imports, orphaned components, and obsolete infrastructure references.

#### 10.2.1 — Remove unused imports
Run `npm run lint:fix` to auto-remove unused imports.

#### 10.2.2 — Check for orphaned components
Verify every component in `src/components/` is actually imported somewhere:

```bash
# For each component file, check if it's imported
for file in $(find src/components -name "*.tsx"); do
  basename=$(basename "$file" .tsx)
  count=$(grep -r "$basename" src/ --include="*.ts" --include="*.tsx" -l | wc -l)
  if [ "$count" -le 1 ]; then
    echo "ORPHAN: $file (only $count references)"
  fi
done
```

#### 10.2.3 — Remove old scheduler references

If Phase 6 (Node.js Scheduler) is complete, remove:
- `src/lib/api/scheduler.ts` (old Python scheduler HTTP client)
- Any references to `SCHEDULER_URL` environment variable
- Old scheduler documentation/comments

**Do not remove** the `scheduler/` directory (Python FastAPI implementation) yet — keep it as reference until production deployment is stable.

---

### 10.3 — Type Safety Audit

```bash
npm run typecheck
```

Fix all type errors. Common issues to check:
- `any` types that should be specific interfaces
- Missing null checks on optional database fields (e.g., `scheduled_at`, `image_url`)
- API response types matching frontend interfaces
- Auth session types including `user.id` and `user.email`
- Drizzle ORM query return types

**Goal**: Zero TypeScript errors before deployment.

---

### 10.4 — Security Hardening

#### 10.4.1 — API route authentication audit

Every API route must have one of:
1. **User auth** — `await getAuthUserId()` (for user-facing endpoints)
2. **Secret-based auth** — `Authorization: Bearer ${CRON_SECRET}` (for cron endpoints)
3. **Webhook signature verification** — `N8N_CALLBACK_SECRET` validation (for n8n callbacks)

**Audit checklist:**

| Route | Auth Method | Status |
|-------|------------|--------|
| `src/app/api/posts/route.ts` | User auth | [ ] Verified |
| `src/app/api/posts/[id]/route.ts` | User auth | [ ] Verified |
| `src/app/api/posts/[id]/schedule/route.ts` | User auth | [ ] Verified |
| `src/app/api/posts/[id]/unschedule/route.ts` | User auth | [ ] Verified |
| `src/app/api/cron/publish-scheduled/route.ts` | CRON_SECRET | [ ] Verified |
| `src/app/api/webhooks/publish-status/route.ts` | N8N_CALLBACK_SECRET | [ ] Verified |
| `src/app/api/settings/route.ts` | User auth | [ ] Verified |
| `src/app/api/settings/linkedin/*/route.ts` | User auth | [ ] Verified |
| `src/app/api/generate/text/route.ts` | User auth | [ ] Verified |
| `src/app/api/generate/image/route.ts` | User auth | [ ] Verified |
| `src/app/api/dashboard/stats/route.ts` | User auth | [ ] Verified |
| `src/app/api/analytics/route.ts` | User auth | [ ] Verified |

#### 10.4.2 — Environment variable audit

Ensure no secrets are in client-side code:

```bash
grep -r "process.env" src/ --include="*.tsx" --include="*.ts" | grep -v "NEXT_PUBLIC_"
```

All non-`NEXT_PUBLIC_` env vars should only appear in:
- Server Components
- API routes (`src/app/api/`)
- Server utilities (`src/lib/`)

**Never** in:
- Client Components (marked with `"use client"`)
- Client-side hooks

#### 10.4.3 — Rate limiting considerations

Add rate limiting to expensive endpoints (implementation optional, but document the need):
- `/api/generate/text` — prevent abuse of expensive AI calls
- `/api/generate/image` — prevent abuse of expensive image generation
- `/api/settings/linkedin/connect` — prevent OAuth flood

**Note:** Rate limiting can be added in Phase 11 using platform-specific rate limiting middleware or hosting platform features (e.g., Vercel Edge Config, reverse proxy rules, etc.).

---

### 10.5 — Performance Check

#### 10.5.1 — Database indexes

Database indexes (posts_user_id_idx, posts_status_idx, posts_scheduled_at_idx, generations_user_id_idx) are defined in Phase 1 (Database Schema Foundation). This phase verifies they exist and performs a performance audit.

Verify indexes exist in `src/lib/db/schema.ts`:

```typescript
// Example indexes (verify these are present):
export const postsUserIdIdx = index("posts_user_id_idx").on(posts.user_id);
export const postsStatusIdx = index("posts_status_idx").on(posts.status);
export const postsScheduledAtIdx = index("posts_scheduled_at_idx").on(posts.scheduled_at);
export const generationsUserIdIdx = index("generations_user_id_idx").on(generations.user_id);
```

#### 10.5.2 — Image optimization

Verify all images use Next.js `<Image>` component with:
- Proper `width` and `height` attributes
- `priority` for above-the-fold images
- `loading="lazy"` for below-the-fold images

#### 10.5.3 — Bundle analysis

```bash
npm run build
# Check the build output for large pages/chunks
# Target: < 200KB first load JS per page
```

Look for:
- Unexpectedly large pages
- Duplicate dependencies
- Unused imports inflating bundle size

---

### 10.6 — UI Consistency Pass

Walk through every page and verify design language consistency.

#### Pages to audit:

| Page | Checklist |
|------|-----------|
| Login (`/`) | Aurora background, glass cards, both auth buttons work |
| Dashboard (`/dashboard`) | Aurora background, stats show real data or "Connect LinkedIn" |
| Calendar (`/calendar`) | Posts render within day bounds, edit modal works, responsive |
| AI Writer (`/ai-writer`) | Full flow works: idea → generate → select → schedule |
| Settings (`/settings`) | LinkedIn URL saves, OAuth connects, connection status displays |
| Analytics (`/analytics`) | Charts render with real data or "Connect" prompt |

#### Design consistency checklist:

- [ ] All pages use `AuroraBackground` component
- [ ] All cards use `glass-card` styling (or equivalent glassmorphism)
- [ ] All buttons use consistent primary/secondary color scheme
- [ ] All icons are Material Symbols Outlined
- [ ] Font is Plus Jakarta Sans throughout
- [ ] Responsive on mobile (viewport 375px minimum width)
- [ ] Dark mode support (if applicable)
- [ ] No visual jank or layout shifts during data loading

---

### 10.7 — Error Boundaries and Loading States

#### 10.7.1 — Add Next.js error boundaries

Create `src/app/error.tsx`:

```tsx
"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="glass-card p-8 text-center max-w-md">
        <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
        <p className="text-gray-600 mb-6">
          {error?.message || "An unexpected error occurred"}
        </p>
        <button
          onClick={() => reset()}
          className="btn-primary px-6 py-2 rounded-lg"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
```

#### 10.7.2 — Add loading states

Create `src/app/loading.tsx` and page-specific loading files:

```tsx
export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-lg">Loading...</div>
    </div>
  );
}
```

Verify all async operations show loading states:
- [ ] Dashboard stats loading
- [ ] Calendar posts loading
- [ ] AI generation in progress
- [ ] Settings saving
- [ ] Analytics charts loading

---

### 10.8 — Documentation Update

#### 10.8.1 — Update `README.md`

Ensure README reflects current state:
- Architecture overview (Next.js + n8n + Node.js scheduler)
- Multi-user support (Auth.js authentication)
- Setup instructions (SQLite for local dev, PostgreSQL for production)
- Environment variables required
- Development workflow (`npm run dev`, `npm run db:generate`, etc.)

#### 10.8.2 — Update `.env.example`

Include every required environment variable with placeholder values and comments:

```bash
# Authentication (Auth.js v5)
AUTH_SECRET=                       # Generate with: npx auth secret
AUTH_GOOGLE_ID=                    # Google Cloud Console OAuth client
AUTH_GOOGLE_SECRET=                # Google Cloud Console OAuth client
AUTH_GITHUB_ID=                    # GitHub Settings > Developer > OAuth Apps
AUTH_GITHUB_SECRET=                # GitHub Settings > Developer > OAuth Apps

# Database (SQLite for dev, PostgreSQL for production)
DATABASE_URL=file:./local.db       # Local: SQLite | Production: PostgreSQL connection string

# AI APIs
ANTHROPIC_API_KEY=                 # Claude text generation
GEMINI_API_KEY=                    # Gemini image generation (if IMAGE_PROVIDER=gemini)
REPLICATE_API_TOKEN=               # FLUX image generation (if IMAGE_PROVIDER=replicate)
IMAGE_PROVIDER=gemini              # "gemini" or "replicate"

# LinkedIn OAuth (Phase 5+)
LINKEDIN_CLIENT_ID=                # LinkedIn Developer App
LINKEDIN_CLIENT_SECRET=            # LinkedIn Developer App
ENCRYPTION_KEY=                    # Generate with: openssl rand -base64 32

# n8n Integration (Phase 5+)
N8N_WEBHOOK_URL=                   # n8n webhook endpoint (e.g., https://n8n.example.com/webhook/linkedin)
N8N_CALLBACK_SECRET=               # Generate with: openssl rand -hex 32

# Scheduler (Phase 6+)
CRON_SECRET=                       # Generate with: openssl rand -hex 32

# App URL
NEXT_PUBLIC_APP_URL=               # Public app URL (e.g., http://localhost:3000 for dev)
```

---

## Verification Checklist

- [ ] `npm run build` succeeds with zero errors
- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run lint` passes with zero warnings (or run `npm run lint:fix`)
- [ ] No `mock-data` imports in production code paths
- [ ] No hardcoded user data (name, email, avatar)
- [ ] All API routes have authentication protection
- [ ] All environment variables documented in `.env.example`
- [ ] README reflects current architecture and setup process
- [ ] Every interactive element has `data-testid` attribute (if Phase 3 complete)
- [ ] Error boundaries catch and display errors gracefully on all pages
- [ ] Loading states prevent blank screens during all async operations
- [ ] Build output is under 200KB first-load JS per page
- [ ] Database has proper indexes on frequently queried columns
- [ ] Two separate users can use the app independently (multi-user isolation verified)

---

## Notes

This is the final quality assurance pass before production deployment. Take your time to catch issues that are easier to fix now than after deployment.
