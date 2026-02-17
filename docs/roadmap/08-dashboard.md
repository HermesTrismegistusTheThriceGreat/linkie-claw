# Phase 8: Dashboard — Real Data (Tiered)

## Goal
Replace mock dashboard data with real data. Tier 1 uses the app's own database. Tier 2 adds LinkedIn API data when available.

## Done When
A logged-in user sees their dashboard populated with real data from the database. If they have connected LinkedIn and the API is approved, they also see LinkedIn analytics.

## Depends On
Phase 3 (Multi-User Support) — dashboard is per-user. Tier 2 depends on LinkedIn Community Management API approval.

---

## CRITICAL CONTEXT: LinkedIn API Analytics

The analytics scopes (`r_member_postAnalytics`, `r_member_profileAnalytics`) are RESTRICTED and require LinkedIn Community Management API approval (2-4 week process, <10% approval rate). Because of this, this phase uses a TWO-TIER approach:

**Tier 1 — DB Analytics (no LinkedIn API needed, build immediately)**:
- Data from the app's own database: posts created, scheduled, published, failed
- Publishing success rate, posts per week/month, content generation history
- No external API calls, no approval needed

**Tier 2 — LinkedIn API Analytics (once Community Management API is approved)**:
- Post impressions, reactions, comments, reposts (via `memberCreatorPostAnalytics` endpoint)
- Follower count and growth (via `memberFollowersCount` endpoint)
- Requires building a simple single-user OAuth flow in the app to get an access token with analytics scopes
- LinkedIn API data retention: post analytics = 60 days, follower data = 12 months

**Action item (outside codebase)**: Apply for LinkedIn Community Management API access during Phase 1, so approval arrives by Phase 8.

---

## Tier 1: DB-Driven Dashboard (build first)

### Step-by-Step Plan

#### 8.1 — Create Real Dashboard Queries

Create `src/lib/db/queries.ts` (or add to existing queries file):

```typescript
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";

export async function getDashboardStats(userId: string) {
  const allPosts = await db
    .select()
    .from(posts)
    .where(eq(posts.userId, userId));

  const totalPosts = allPosts.length;
  const drafts = allPosts.filter(p => p.status === "draft").length;
  const scheduled = allPosts.filter(p => p.status === "scheduled").length;
  const published = allPosts.filter(p => p.status === "published").length;
  const failed = allPosts.filter(p => p.status === "failed").length;

  return {
    totalPosts,
    drafts,
    scheduled,
    published,
    failed,
  };
}

export async function getPublishingSuccessRate(userId: string): Promise<number> {
  const stats = await getDashboardStats(userId);
  const total = stats.published + stats.failed;
  if (total === 0) return 0;
  return Math.round((stats.published / total) * 100);
}

export async function getPostsOverTime(userId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const postsData = await db
    .select({
      date: sql<string>`DATE(${posts.createdAt})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(posts)
    .where(
      and(
        eq(posts.userId, userId),
        gte(posts.createdAt, startDate)
      )
    )
    .groupBy(sql`DATE(${posts.createdAt})`)
    .orderBy(sql`DATE(${posts.createdAt})`);

  return postsData;
}

export async function getRecentPosts(userId: string, limit: number = 5) {
  return await db
    .select()
    .from(posts)
    .where(eq(posts.userId, userId))
    .orderBy(desc(posts.createdAt))
    .limit(limit);
}

export async function getGenerationCount(userId: string): Promise<number> {
  // Assuming posts have a `generatedByAi` boolean field
  // If not, count all posts as generations for now
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(posts)
    .where(eq(posts.userId, userId));

  return result[0]?.count ?? 0;
}
```

---

#### 8.2 — Create Dashboard API Route

Create `src/app/api/dashboard/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import {
  getDashboardStats,
  getPublishingSuccessRate,
  getPostsOverTime,
  getRecentPosts,
  getGenerationCount,
} from "@/lib/db/queries";

export async function GET() {
  try {
    const userId = await getAuthUserId();

    const [stats, successRate, postsOverTime, recentPosts, generationCount] =
      await Promise.all([
        getDashboardStats(userId),
        getPublishingSuccessRate(userId),
        getPostsOverTime(userId, 30),
        getRecentPosts(userId, 5),
        getGenerationCount(userId),
      ]);

    return NextResponse.json({
      stats,
      successRate,
      postsOverTime,
      recentPosts,
      generationCount,
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
```

---

#### 8.3 — Update Dashboard Page and Components

**8.3.1 — Update `src/lib/queries/stats.ts`**

Replace mock data with real API calls:

```typescript
import type { DashboardStats, StatCard, FollowerDataPoint } from "@/types/stats";

export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await fetch("/api/dashboard", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch dashboard stats");
  }

  const data = await response.json();

  // Transform database data into dashboard format
  const cards: StatCard[] = [
    {
      label: "Total Posts",
      value: data.stats.totalPosts.toString(),
      change: 0, // Can calculate week-over-week change if needed
      changeLabel: "",
      icon: "article",
      color: "orange",
    },
    {
      label: "Success Rate",
      value: `${data.successRate}%`,
      change: 0,
      changeLabel: "",
      icon: "bolt",
      color: "purple",
    },
    {
      label: "Published",
      value: data.stats.published.toString(),
      change: 0,
      changeLabel: "",
      icon: "check_circle",
      color: "blue",
    },
  ];

  // Transform posts over time into chart data
  const followerGrowth: FollowerDataPoint[] = data.postsOverTime.map((point: any) => ({
    date: point.date,
    count: point.count,
  }));

  return {
    cards,
    followerGrowth,
    totalPosts: data.stats.totalPosts, // Total posts count from DB
  };
}

export async function getStatCards(): Promise<StatCard[]> {
  const stats = await getDashboardStats();
  return stats.cards;
}

export async function getFollowerGrowth(): Promise<FollowerDataPoint[]> {
  const stats = await getDashboardStats();
  return stats.followerGrowth;
}

export async function getTotalFollowers(): Promise<number> {
  const stats = await getDashboardStats();
  return stats.totalPosts;
}

export async function getChartHeights(): Promise<number[]> {
  const growth = await getFollowerGrowth();
  if (growth.length === 0) return [];

  const maxCount = Math.max(...growth.map(d => d.count));
  return growth.map(d => Math.round((d.count / maxCount) * 100));
}
```

**8.3.2 — Update `src/components/dashboard/stats-row.tsx`**

The existing component should work as-is, but add error handling:

```typescript
import { getDashboardStats } from "@/lib/queries/stats";
import { StatCard } from "./stat-card";

export async function StatsRow() {
  try {
    const stats = await getDashboardStats();

    if (stats.cards.length === 0) {
      return (
        <div className="glass-card p-8 rounded-3xl text-center">
          <p className="text-slate-500">Create your first post to see stats!</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.cards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>
    );
  } catch (error) {
    return (
      <div className="glass-card p-8 rounded-3xl text-center">
        <p className="text-red-500">Failed to load stats. Please try again.</p>
      </div>
    );
  }
}
```

**8.3.3 — Update `src/components/dashboard/follower-chart.tsx`**

Replace mock data with real posting activity data:

```typescript
import { getChartHeights, getDashboardStats } from "@/lib/queries/stats";
import { cn } from "@/lib/utils";

export async function FollowerChart() {
  const stats = await getDashboardStats();
  const chartHeights = await getChartHeights();

  // If no data, show empty state
  if (chartHeights.length === 0) {
    return (
      <div className="glass-card p-8 rounded-3xl border border-white/50 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold">Posting Activity</h3>
            <p className="text-sm text-slate-500 font-medium">
              Posts created: 0
            </p>
          </div>
        </div>
        <div className="h-48 w-full flex items-center justify-center">
          <p className="text-slate-400">No posting activity yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-8 rounded-3xl border border-white/50 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-xl font-bold">Posting Activity</h3>
          <p className="text-sm text-slate-500 font-medium">
            Total: {stats.totalPosts} posts
          </p>
        </div>
        <select className="bg-transparent border-none text-sm font-bold focus:ring-0 cursor-pointer">
          <option>Last 30 Days</option>
          <option>Last 7 Days</option>
          <option>Last 6 Months</option>
        </select>
      </div>

      <div className="h-48 w-full flex items-end justify-between gap-1 relative">
        {chartHeights.map((height, index) => {
          const isPeak = height > 80;
          return (
            <div
              key={index}
              className={cn(
                "flex-1 rounded-t-lg transition-colors",
                isPeak
                  ? "bg-primary/40 border-t-2 border-primary hover:bg-primary/50"
                  : "bg-primary/20 hover:bg-primary/40"
              )}
              style={{ height: `${height}%` }}
            />
          );
        })}
      </div>

      <div className="flex justify-between mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">
        <span>30 days ago</span>
        <span>15 days ago</span>
        <span>Today</span>
      </div>
    </div>
  );
}
```

---

#### 8.4 — Remove Mock Data Usage

Delete or deprecate:
- `src/lib/mock-data/stats.ts` (or mark as deprecated)
- Remove `mockChartHeights` imports

---

#### 8.5 — Handle Empty State

Already implemented in the components above with conditional rendering for new users with no posts.

---

### Tier 1 Verification Checklist

- [ ] Dashboard loads with real data from database
- [ ] Stats reflect actual post counts (drafts, scheduled, published, failed)
- [ ] Chart shows real posting activity over time (not mock data)
- [ ] New user sees zeros / empty state (not mock data)
- [ ] Each user sees only their own data
- [ ] Data updates when posts are created/published
- [ ] No mock data imports remain in dashboard components

---

## Tier 2: LinkedIn API Dashboard (build when approved)

### Step-by-Step Plan

#### 8.6 — Build Simple Single-User LinkedIn OAuth Flow

**8.6.1 — Database schema**

All LinkedIn OAuth fields (linkedin_access_token, linkedin_refresh_token, linkedin_token_expires_at, linkedin_person_urn, linkedin_oauth_status) are defined on the user_settings table in Phase 1 (Database Schema Foundation).

The `linkedin_oauth_states` table for CSRF protection during OAuth flow is defined in Phase 1.

**Encryption Setup:** The encryption module for LinkedIn token storage (`src/lib/encryption.ts`) should be implemented in this phase when the LinkedIn OAuth flow is built. Create this module using Node.js built-in `crypto` module with AES-256-GCM. The `ENCRYPTION_KEY` environment variable (already in `.env`) provides the key. The `encrypt()` function returns a string combining the IV, auth tag, and ciphertext (e.g., base64-encoded). The `decrypt()` function reverses this process. Both are used below to protect LinkedIn tokens at rest.

**8.6.2 — Create LinkedIn OAuth endpoints**

Create `src/app/api/linkedin/connect/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";

const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/linkedin/callback`;
const SCOPES = "openid profile r_member_postAnalytics r_member_profileAnalytics";

export async function POST() {
  const userId = await getAuthUserId();

  // Generate state parameter for CSRF protection
  const state = crypto.randomUUID();

  // Store state in a short-lived database record tied to the user's session.
  // Create a `linkedin_oauth_states` table with columns: state (PK), user_id, expires_at.
  // Set expiry to 10 minutes from now. The callback route will look up this
  // record, verify it matches and hasn't expired, then delete it.
  await db.insert(linkedinOauthStates).values({
    state,
    userId,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
  });

  const authUrl = new URL(LINKEDIN_AUTH_URL);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("state", state);

  return NextResponse.json({ authUrl: authUrl.toString() });
}
```

Create `src/app/api/linkedin/callback/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID!;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/linkedin/callback`;

export async function GET(request: NextRequest) {
  const userId = await getAuthUserId();
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code) {
    return NextResponse.redirect(new URL("/settings?error=no_code", request.url));
  }

  // Verify state parameter against the stored record
  const storedState = await db
    .select()
    .from(linkedinOauthStates)
    .where(and(eq(linkedinOauthStates.state, state!), eq(linkedinOauthStates.userId, userId)))
    .limit(1);

  if (!storedState.length || new Date() > storedState[0].expiresAt) {
    // State mismatch or expired — possible CSRF attack
    await db.delete(linkedinOauthStates).where(eq(linkedinOauthStates.state, state!));
    return NextResponse.redirect(new URL("/settings?error=invalid_state", request.url));
  }

  // Clean up used state record
  await db.delete(linkedinOauthStates).where(eq(linkedinOauthStates.state, state!));

  // Exchange code for token
  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect(new URL("/settings?error=token_exchange_failed", request.url));
  }

  const tokenData = await tokenResponse.json();
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

  // Encrypt tokens before storing (use a library like @noble/ciphers or crypto-js)
  const encryptedAccessToken = await encrypt(tokenData.access_token);
  const encryptedRefreshToken = tokenData.refresh_token
    ? await encrypt(tokenData.refresh_token)
    : null;

  // Get person URN from LinkedIn
  const userInfoResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });
  const userInfo = await userInfoResponse.json();

  // Store in database
  await db.insert(userSettings).values({
    userId,
    linkedinAccessToken: encryptedAccessToken,
    linkedinRefreshToken: encryptedRefreshToken,
    linkedinTokenExpiresAt: expiresAt,
    linkedinPersonUrn: userInfo.sub,
    linkedinOauthStatus: "connected",
  }).onConflictDoUpdate({
    target: userSettings.userId,
    set: {
      linkedinAccessToken: encryptedAccessToken,
      linkedinRefreshToken: encryptedRefreshToken,
      linkedinTokenExpiresAt: expiresAt,
      linkedinPersonUrn: userInfo.sub,
      linkedinOauthStatus: "connected",
    },
  });

  return NextResponse.redirect(new URL("/dashboard?success=linkedin_connected", request.url));
}
```

---

#### 8.7 — Create LinkedIn API Client

Create `src/lib/linkedin/client.ts`:

```typescript
const LINKEDIN_API_BASE = "https://api.linkedin.com/rest";

export class LinkedInApiClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request(endpoint: string, params?: Record<string, string>) {
    const url = new URL(`${LINKEDIN_API_BASE}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "LinkedIn-Version": "202601",
        "X-Restli-Protocol-Version": "2.0.0",
      },
    });

    if (!response.ok) {
      throw new Error(`LinkedIn API error: ${response.status}`);
    }

    return response.json();
  }

  async getPostAnalytics(postUrn: string) {
    // Fetch impressions, reactions, comments for a specific post
    const impressions = await this.request("/memberCreatorPostAnalytics", {
      q: "me",
      queryType: "IMPRESSION",
      aggregation: "DAILY",
    });

    const reactions = await this.request("/memberCreatorPostAnalytics", {
      q: "me",
      queryType: "REACTION",
      aggregation: "TOTAL",
    });

    const comments = await this.request("/memberCreatorPostAnalytics", {
      q: "me",
      queryType: "COMMENT",
      aggregation: "TOTAL",
    });

    return { impressions, reactions, comments };
  }

  async getFollowerCount(): Promise<number> {
    const response = await this.request("/memberFollowersCount", { q: "me" });
    return response.followerCount ?? 0;
  }

  async getFollowerGrowth(days: number = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const response = await this.request("/memberFollowersCount", {
      q: "dateRange",
      "dateRange.start": startDate.getTime().toString(),
      "dateRange.end": endDate.getTime().toString(),
    });

    return response.followerCountsByDate ?? [];
  }
}
```

---

#### 8.8 — Update Dashboard to Show LinkedIn Data

**8.8.1 — Update dashboard API route**

Modify `src/app/api/dashboard/route.ts` to include LinkedIn data:

```typescript
import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserSettings } from "@/lib/db/queries";
import { LinkedInApiClient } from "@/lib/linkedin/client";
import { decrypt } from "@/lib/encryption";
// ... other imports

export async function GET() {
  try {
    const userId = await getAuthUserId();
    const settings = await getUserSettings(userId);

    // Get database stats
    const [stats, successRate, postsOverTime, recentPosts, generationCount] =
      await Promise.all([
        getDashboardStats(userId),
        getPublishingSuccessRate(userId),
        getPostsOverTime(userId, 30),
        getRecentPosts(userId, 5),
        getGenerationCount(userId),
      ]);

    const response: any = {
      stats,
      successRate,
      postsOverTime,
      recentPosts,
      generationCount,
      linkedinConnected: false,
    };

    // If LinkedIn is connected, fetch LinkedIn data
    if (settings?.linkedinOauthStatus === "connected" && settings.linkedinAccessToken) {
      try {
        const accessToken = await decrypt(settings.linkedinAccessToken);
        const client = new LinkedInApiClient(accessToken);

        const [followerCount, followerGrowth] = await Promise.all([
          client.getFollowerCount(),
          client.getFollowerGrowth(30),
        ]);

        response.linkedinConnected = true;
        response.linkedinData = {
          followerCount,
          followerGrowth,
        };
      } catch (error) {
        console.error("LinkedIn API error:", error);
        // Continue without LinkedIn data
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
```

**8.8.2 — Update dashboard components to show LinkedIn data**

Update `src/components/dashboard/follower-chart.tsx` to show LinkedIn follower growth when available:

```typescript
export async function FollowerChart() {
  const response = await fetch("/api/dashboard", { cache: "no-store" });
  const data = await response.json();

  if (data.linkedinConnected && data.linkedinData) {
    // Show LinkedIn follower growth chart
    const { followerCount, followerGrowth } = data.linkedinData;
    // ... render with LinkedIn data
  } else {
    // Show posting activity chart (Tier 1)
    // ... existing implementation
  }
}
```

Add a "Connect LinkedIn" prompt when not connected:

```typescript
if (!data.linkedinConnected) {
  return (
    <div className="glass-card p-8 rounded-3xl border border-white/50 shadow-sm">
      <h3 className="text-xl font-bold mb-4">LinkedIn Analytics</h3>
      <p className="text-sm text-slate-500 mb-4">
        Connect your LinkedIn account to see follower growth and post impressions.
      </p>
      <form action="/api/linkedin/connect" method="POST">
        <button className="bg-primary text-white px-4 py-2 rounded-lg font-bold">
          Connect LinkedIn
        </button>
      </form>
    </div>
  );
}
```

---

#### 8.9 — Add Caching

Create `src/lib/cache.ts`:

```typescript
const cache = new Map<string, { data: any; expires: number }>();

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache<T>(key: string, data: T, ttl: number = CACHE_TTL) {
  cache.set(key, {
    data,
    expires: Date.now() + ttl,
  });
}

export function clearCache(key: string) {
  cache.delete(key);
}
```

Use in dashboard API:

```typescript
const cacheKey = `dashboard:${userId}`;
const cached = getCached(cacheKey);
if (cached) return NextResponse.json(cached);

// ... fetch data
const response = { /* ... */ };
setCache(cacheKey, response);
return NextResponse.json(response);
```

---

#### 8.10 — Handle Error States

Add error handling for:
- Not connected: show "Connect LinkedIn" prompt
- Token expired: show "Reconnect LinkedIn" with refresh flow
- Rate limited: show cached data with "Last updated" timestamp
- API error: show error message with retry button
- No data yet: show empty state

---

### Tier 2 Verification Checklist

- [ ] "Connect LinkedIn" flow works and redirects to LinkedIn
- [ ] OAuth callback successfully exchanges code for token
- [ ] Token stored encrypted in database
- [ ] Dashboard shows LinkedIn follower count when connected
- [ ] Shows "Connect LinkedIn" prompt when not connected
- [ ] Follower growth chart shows real daily data from LinkedIn
- [ ] Post impressions displayed (if available)
- [ ] Token refresh works before expiry
- [ ] Cache prevents excessive API calls (15-minute TTL)
- [ ] Error states handled gracefully (expired token, API error, rate limit)
- [ ] Each user sees only their own LinkedIn data

---

## LinkedIn API Endpoints Used

```
GET /rest/memberCreatorPostAnalytics?q=me&queryType=IMPRESSION&aggregation=DAILY
GET /rest/memberCreatorPostAnalytics?q=me&queryType=REACTION&aggregation=TOTAL
GET /rest/memberCreatorPostAnalytics?q=me&queryType=COMMENT&aggregation=TOTAL
GET /rest/memberFollowersCount?q=me
GET /rest/memberFollowersCount?q=dateRange&dateRange.start=...&dateRange.end=...
GET /v2/userinfo
```

**Required Scopes**: `r_member_postAnalytics`, `r_member_profileAnalytics`, `openid`, `profile`

**Required Headers**:
```
Authorization: Bearer {TOKEN}
LinkedIn-Version: 202601
X-Restli-Protocol-Version: 2.0.0
```

---

## Notes

- LinkedIn API data retention: post analytics = 60 days, follower data = 12 months
- The app should cache historical data locally if long-term trending is desired (future enhancement)
- Build Tier 1 first and verify it works before starting Tier 2
- Apply for LinkedIn Community Management API access as early as possible (2-4 week approval process)
