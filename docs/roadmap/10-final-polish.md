# Phase 10: Final Polish — Mock Data Audit & Production Readiness

## Goal
Audit the entire codebase for remaining mock data, hardcoded values, disabled features, and rough edges. Ensure everything is production-ready.

## Done When
Zero mock data remains in production paths, all pages use live data, security is hardened, and the app passes a final production readiness review.

## Depends On
Phases 7, 8, 9 (all features must be built before the final audit)

---

## Step-by-Step Plan

### 10.1 — Mock Data Audit

Search and eliminate every instance of mock data still used in production code.

#### Files to audit:

| File | Mock Data | Status After Phase 6 | Action |
|------|----------|----------------------|--------|
| `src/lib/mock-data/stats.ts` | Dashboard stats (reach, engagement, followers) | Replaced by LinkedIn API | **Delete file** |
| `src/lib/mock-data/posts.ts` | Sample posts and drafts | Used only for dev seeding | **Keep but exclude from production build** |
| `src/lib/mock-data/generations.ts` | AI generation mock sessions | May still be used in dev | **Keep but exclude from production build** |
| `src/lib/queries/stats.ts` | Returns mock data with fake delays | Replaced by `src/lib/linkedin/api.ts` | **Delete** or redirect to LinkedIn API |
| `src/components/layout/user-card.tsx` | Hardcoded "Alex Rivera" | Replaced in Phase 1 with session data | **Verify** |
| `src/components/dashboard/follower-chart.tsx` | `mockChartHeights` array | Replaced in Phase 6 | **Verify** |
| `src/components/dashboard/stats-row.tsx` | Calls `getDashboardStats()` (mock) | Replaced in Phase 6 | **Verify** |

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

---

### 10.2 — Dead Code Removal

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

#### 10.2.3 — Remove the old scheduler dependency (if using QStash)
If the Python scheduler is fully replaced by QStash:
- Remove `scheduler/` from the build process
- Update `docker-compose.yml` to only run n8n
- Remove the `SCHEDULER_URL` environment variable references

---

### 10.3 — Type Safety Audit

```bash
npm run typecheck
```

Fix all type errors. Common issues to check:
- `any` types that should be specific interfaces
- Missing null checks on optional database fields
- API response types matching frontend interfaces
- Auth session types including `user.id`

---

### 10.4 — Security Hardening

#### 10.4.1 — API route protection audit

Every API route must have one of:
1. **User auth** — `await getAuthUserId()` (for user-facing endpoints)
2. **Secret-based auth** — `Bearer ${process.env.INTERNAL_API_SECRET}` (for scheduler/n8n callbacks)
3. **QStash signature verification** — `verifySignatureAppRouter` (for QStash-triggered endpoints)

Audit checklist:
```
src/app/api/posts/route.ts              → User auth ✓
src/app/api/posts/[id]/route.ts         → User auth ✓
src/app/api/posts/[id]/schedule/route.ts → User auth ✓
src/app/api/posts/[id]/unschedule/route.ts → User auth ✓
src/app/api/posts/dispatch/route.ts     → QStash signature ✓
src/app/api/posts/recover/route.ts      → Cron secret ✓
src/app/api/settings/route.ts           → User auth ✓
src/app/api/settings/linkedin/*/route.ts → User auth ✓
src/app/api/settings/linkedin/token/route.ts → Internal secret ✓
src/app/api/webhooks/publish-status/route.ts → n8n callback secret ✓
src/app/api/generate/text/route.ts      → User auth ✓
src/app/api/generate/image/route.ts     → User auth ✓
src/app/api/dashboard/stats/route.ts    → User auth ✓
src/app/api/analytics/route.ts          → User auth ✓
```

#### 10.4.2 — Environment variable audit
Ensure no secrets are in client-side code:
```bash
grep -r "process.env" src/ --include="*.tsx" --include="*.ts" | grep -v "NEXT_PUBLIC_"
```
All non-`NEXT_PUBLIC_` env vars should only appear in server-side files.

#### 10.4.3 — Content Security Policy
Add CSP headers in `next.config.ts`:
```typescript
headers: async () => [{
  source: "/(.*)",
  headers: [{
    key: "Content-Security-Policy",
    value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; ..."
  }]
}]
```

#### 10.4.4 — Rate limiting
Add rate limiting (using Upstash Ratelimit) to:
- `/api/generate/text` — prevent abuse of expensive AI calls
- `/api/generate/image` — same
- `/api/settings/linkedin/connect` — prevent OAuth flood
- All public API routes

---

### 10.5 — Performance Optimization

#### 10.5.1 — Database indexes
Add indexes for frequently queried columns:
```typescript
// In schema.ts, after table definitions:
export const postsUserIdIdx = index("posts_user_id_idx").on(posts.user_id);
export const postsStatusIdx = index("posts_status_idx").on(posts.status);
export const postsScheduledAtIdx = index("posts_scheduled_at_idx").on(posts.scheduled_at);
```

#### 10.5.2 — Image optimization
Ensure all images use Next.js `<Image>` component with proper `width`, `height`, and `priority` attributes.

#### 10.5.3 — Bundle analysis
```bash
npm run build
# Check the build output for large pages/chunks
# Target: < 200KB first load JS per page
```

---

### 10.6 — Documentation Update

#### 10.6.1 — Update `README.md`
Reflect the new architecture:
- PostgreSQL instead of SQLite
- Auth.js authentication
- QStash scheduling
- LinkedIn OAuth flow
- Multi-user support
- Vercel deployment instructions

#### 10.6.2 — Create `.env.example`
Include every required environment variable with placeholder values and comments:
```bash
# Authentication (Auth.js v5)
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# Database (Vercel Postgres / Neon)
DATABASE_URL=

# AI APIs
ANTHROPIC_API_KEY=
GEMINI_API_KEY=

# LinkedIn OAuth
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=

# Scheduling (Upstash QStash)
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=

# Token Encryption
ENCRYPTION_KEY=

# Internal API Auth
INTERNAL_API_SECRET=
CRON_SECRET=

# n8n
N8N_WEBHOOK_URL=
N8N_CALLBACK_SECRET=

# App URL
NEXT_PUBLIC_APP_URL=
```

---

### 10.7 — Final UI Consistency Pass

Walk through every page and verify:

| Page | Check |
|------|-------|
| Login | Clean design, both auth buttons work |
| Dashboard | All cards show real data or "Connect LinkedIn" |
| Calendar | Posts render within day bounds, edit modal works |
| AI Writer | Full flow: idea → generate → select → schedule |
| Settings | LinkedIn URL saves, OAuth connects, status shows |
| Analytics | All charts render with real data or "Connect" prompt |

#### Design consistency:
- [ ] All pages use `AuroraBackground`
- [ ] All cards use `glass-card` styling
- [ ] All buttons use the primary color scheme
- [ ] All icons are Material Symbols Outlined
- [ ] Font is Plus Jakarta Sans throughout
- [ ] Responsive on mobile (viewport 375px+)
- [ ] Dark mode support (if applicable)

---

### 10.8 — Error Boundary and Loading States

#### 10.8.1 — Add Next.js error boundaries
Create `src/app/error.tsx`:
```tsx
"use client";
export default function Error({ error, reset }) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="glass-card p-8 text-center">
        <h2>Something went wrong!</h2>
        <p>{error?.message || "An unexpected error occurred"}</p>
        <button onClick={() => reset()} className="btn-primary mt-4">Try Again</button>
      </div>
    </div>
  );
}
```

#### 10.8.2 — Add loading states
Create `src/app/loading.tsx` and page-specific loading files:
```tsx
export default function Loading() {
  return <div className="animate-pulse ...">Loading...</div>;
}
```

---

## Final Verification Checklist

- [ ] `npm run build` succeeds with zero errors
- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm run lint` passes with zero warnings
- [ ] No `mock-data` imports in production code paths
- [ ] No hardcoded user data (name, email, avatar)
- [ ] All API routes have authentication protection
- [ ] All environment variables are documented in `.env.example`
- [ ] README reflects current architecture
- [ ] Every page has proper `data-testid` attributes
- [ ] Error boundaries catch and display errors gracefully
- [ ] Loading states prevent blank screens during data fetch
- [ ] Build output is under 200KB first-load JS per page
- [ ] LinkedIn API calls are cached appropriately
- [ ] Database has proper indexes
- [ ] App deploys successfully to Vercel
- [ ] Two separate users can use the full app independently
