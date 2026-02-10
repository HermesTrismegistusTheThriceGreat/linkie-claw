# Phase 6: Dashboard Page — Live LinkedIn Analytics via API

## Goal
Replace mock dashboard data with real LinkedIn analytics fetched via each user's OAuth token. Display impressions, engagement rate, follower growth, and post performance.

## Done When
A logged-in user with a connected LinkedIn account sees their real analytics data rendered on the Dashboard page.

## Depends On
Phase 5 (LinkedIn OAuth tokens must be stored per-user)

---

## Step-by-Step Plan

### 6.1 — Research LinkedIn API Endpoints

The LinkedIn API (as of 2025) uses versioned endpoints with the base path `https://api.linkedin.com/rest/` and requires the `LinkedIn-Version: YYYYMM` header.

#### Key endpoints:

| Data | Endpoint | Scope Required |
|------|----------|----------------|
| **Profile info** | `GET /v2/userinfo` | `openid profile` |
| **Organization stats** | `GET /rest/organizationalEntityFollowerStatistics` | `r_organization_social` |
| **Post impressions/engagement** | `GET /rest/organizationalEntityShareStatistics` | `r_organization_social` |
| **Follower demographics** | `GET /rest/organizationalEntityFollowerStatistics?q=organizationalEntity` | `rw_organization_admin` |
| **Individual post stats** | `GET /rest/shares/{shareId}/statistics` | `r_organization_social` |
| **Profile views** | Limited availability — may not be accessible for personal accounts | — |

> **Important limitation:** Personal profile analytics (impressions, reach on personal posts) are only available through LinkedIn's new "Creator Mode" APIs, which may require partnership-level access. For organization pages, the API is more open. The plan should handle both scenarios gracefully.

---

### 6.2 — Create LinkedIn API Client

Create `src/lib/linkedin/api.ts`:

```typescript
export class LinkedInApiClient {
  private accessToken: string;
  private personUrn: string;
  
  constructor(accessToken: string, personUrn: string) {
    this.accessToken = accessToken;
    this.personUrn = personUrn;
  }
  
  private async request(url: string, params?: Record<string, string>) {
    const fullUrl = new URL(url);
    if (params) {
      Object.entries(params).forEach(([k, v]) => fullUrl.searchParams.set(k, v));
    }
    
    const response = await fetch(fullUrl.toString(), {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "LinkedIn-Version": "202501",
        "X-Restli-Protocol-Version": "2.0.0",
      },
    });
    
    if (!response.ok) {
      throw new Error(`LinkedIn API error: ${response.status}`);
    }
    
    return response.json();
  }
  
  async getFollowerCount(): Promise<number> { ... }
  async getPostImpressions(timeRange: TimeRange): Promise<ImpressionData[]> { ... }
  async getEngagementRate(timeRange: TimeRange): Promise<number> { ... }
  async getFollowerGrowth(timeRange: TimeRange): Promise<FollowerDataPoint[]> { ... }
  async getRecentPostPerformance(limit: number): Promise<PostPerformance[]> { ... }
}
```

---

### 6.3 — Create Dashboard API Route

#### 6.3.1 — `src/app/api/dashboard/stats/route.ts`

```typescript
export async function GET() {
  const userId = await getAuthUserId();
  const settings = await getUserSettings(userId);
  
  // If LinkedIn is not connected, return placeholder data
  if (settings?.linkedin_oauth_status !== "connected") {
    return NextResponse.json({
      connected: false,
      message: "Connect LinkedIn in Settings to see your analytics",
    });
  }
  
  // Check/refresh token if expired
  const accessToken = await getValidToken(userId);
  
  const client = new LinkedInApiClient(accessToken, settings.linkedin_person_urn);
  
  const [impressions, engagementRate, followerGrowth, followerCount, postPerformance] = 
    await Promise.allSettled([
      client.getPostImpressions({ days: 30 }),
      client.getEngagementRate({ days: 30 }),
      client.getFollowerGrowth({ days: 30 }),
      client.getFollowerCount(),
      client.getRecentPostPerformance(5),
    ]);
  
  return NextResponse.json({
    connected: true,
    stats: {
      cards: [
        {
          label: "Post Reach",
          value: formatNumber(resolveOrDefault(impressions, 0)),
          change: calculateChange(impressions),
          icon: "visibility",
          color: "orange",
        },
        {
          label: "Engagement Rate",
          value: `${resolveOrDefault(engagementRate, 0)}%`,
          change: calculateChange(engagementRate),
          icon: "bolt",
          color: "purple",
        },
        {
          label: "New Followers",
          value: formatNumber(calculateNewFollowers(followerGrowth)),
          change: calculateFollowerChange(followerGrowth),
          icon: "group_add",
          color: "blue",
        },
      ],
      totalFollowers: resolveOrDefault(followerCount, 0),
      followerGrowth: resolveOrDefault(followerGrowth, []),
      recentPostPerformance: resolveOrDefault(postPerformance, []),
    },
  });
}
```

---

### 6.4 — Update Dashboard Components

#### 6.4.1 — Replace `src/lib/queries/stats.ts`

Instead of returning mock data, this should call the new API:

```typescript
export async function getDashboardStats(userId: string): Promise<DashboardStats | null> {
  // For server components, call the LinkedIn API client directly
  // For client components, fetch via /api/dashboard/stats
}
```

#### 6.4.2 — Update `src/components/dashboard/stats-row.tsx`

Replace mock data with real API data, falling back to a "Connect LinkedIn" prompt:

```tsx
export async function StatsRow() {
  const userId = await getAuthUserId();
  const stats = await getDashboardStats(userId);
  
  if (!stats?.connected) {
    return (
      <div className="glass-card p-8 rounded-3xl text-center">
        <p>Connect your LinkedIn account in Settings to see your analytics</p>
        <Link href="/settings">Go to Settings</Link>
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
}
```

#### 6.4.3 — Update `src/components/dashboard/follower-chart.tsx`

Replace `mockChartHeights` with real follower growth data from the API. The chart rendering logic stays the same, but should:
- Use real daily follower counts
- Calculate bar heights proportionally from real data
- Show real date labels on the x-axis

#### 6.4.4 — Update `src/components/dashboard/recent-drafts.tsx`

This already uses mock data from `src/lib/mock-data/posts.ts`. Replace with:
```typescript
const drafts = await getRecentDrafts(5, userId); // Real DB query
```

#### 6.4.5 — Update `src/components/dashboard/planner-widget.tsx`

Replace mock planner data with upcoming scheduled posts from the database:
```typescript
const upcomingPosts = await getUpcomingScheduledPosts(7, userId); // Next 7 days
```

---

### 6.5 — Add Data Caching

LinkedIn API has rate limits (~100 requests/day for consumer apps). Implement caching:

#### 6.5.1 — Cache strategy
- Cache dashboard stats for 15 minutes per user
- Use a simple in-memory cache or Redis (Upstash Redis works well on Vercel)
- On page load, serve cached data immediately, then refresh in background

#### 6.5.2 — Implementation option: Vercel KV (Upstash Redis)
```typescript
import { kv } from "@vercel/kv";

const CACHE_TTL = 15 * 60; // 15 minutes

export async function getCachedDashboardStats(userId: string) {
  const cacheKey = `dashboard:${userId}`;
  const cached = await kv.get(cacheKey);
  if (cached) return cached;
  
  const stats = await fetchFreshStats(userId);
  await kv.set(cacheKey, stats, { ex: CACHE_TTL });
  return stats;
}
```

---

### 6.6 — Handle Error States

The dashboard must handle these scenarios gracefully:

| State | Display |
|-------|---------|
| LinkedIn not connected | "Connect LinkedIn in Settings" card with link |
| Token expired | "Reconnect LinkedIn" prompt |
| API rate limited | Show cached data with "Last updated X minutes ago" |
| API error | Show error with retry button |
| No data yet (new user) | "Start posting to see your analytics" |

---

## Verification Checklist

- [ ] Dashboard loads with real data when LinkedIn is connected
- [ ] Dashboard shows "Connect LinkedIn" prompt when not connected
- [ ] Post Reach stat card shows real impressions data
- [ ] Engagement Rate stat card shows calculated engagement percentage
- [ ] New Followers stat card shows real follower count change
- [ ] Follower Growth chart shows real daily data
- [ ] Recent Drafts section shows user's actual drafts from DB
- [ ] Planner widget shows upcoming scheduled posts from DB
- [ ] Data refreshes on page reload
- [ ] Each user sees only their own data
- [ ] Error states are handled gracefully (no blank page crash)
- [ ] Data is cached to respect LinkedIn API rate limits
