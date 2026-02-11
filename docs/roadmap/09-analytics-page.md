# Phase 9: Analytics Page — Detailed Insights (Tiered)

## Goal
Build a dedicated Analytics page with charts, tables, and detailed breakdowns. Same two-tier approach: Tier 1 uses database analytics, Tier 2 adds LinkedIn API data when available.

## Done When
A logged-in user can navigate to the Analytics page from the sidebar and see detailed charts and breakdowns. If LinkedIn is connected, they see additional engagement metrics.

## Depends On
Phase 8 (Dashboard) — reuses Tier 1 queries and Tier 2 LinkedIn OAuth

---

## CRITICAL CONTEXT: LinkedIn API Analytics

This phase follows the same two-tier approach as Phase 8:

**Tier 1 — DB Analytics (no LinkedIn API needed, build immediately)**:
- Data from the app's own database
- Publishing trends, content status breakdown, scheduling patterns
- No external API calls, no approval needed

**Tier 2 — LinkedIn API Analytics (once Community Management API is approved)**:
- Post impressions, engagement rates, top posts by impressions
- Uses the same OAuth token from Phase 8 Tier 2
- No additional OAuth flow needed

---

## Tier 1: DB-Driven Analytics

### Step-by-Step Plan

#### 9.1 — Enable Analytics Sidebar Link

Update `src/components/layout/sidebar.tsx`:

```diff
-  { href: "/analytics", icon: "insights", label: "Analytics", disabled: true },
+  { href: "/analytics", icon: "insights", label: "Analytics" },
```

---

#### 9.2 — Create Analytics Queries

Add to `src/lib/db/queries.ts`:

```typescript
export async function getPostsByStatus(
  userId: string,
  dateRange: { start: Date; end: Date }
) {
  const postsData = await db
    .select({
      date: sql<string>`DATE(${posts.createdAt})`,
      status: posts.status,
      count: sql<number>`COUNT(*)`,
    })
    .from(posts)
    .where(
      and(
        eq(posts.userId, userId),
        gte(posts.createdAt, dateRange.start),
        lte(posts.createdAt, dateRange.end)
      )
    )
    .groupBy(sql`DATE(${posts.createdAt})`, posts.status)
    .orderBy(sql`DATE(${posts.createdAt})`);

  return postsData;
}

export async function getPublishingTrend(
  userId: string,
  dateRange: { start: Date; end: Date }
) {
  const trend = await db
    .select({
      date: sql<string>`DATE(${posts.createdAt})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(posts)
    .where(
      and(
        eq(posts.userId, userId),
        eq(posts.status, "published"),
        gte(posts.createdAt, dateRange.start),
        lte(posts.createdAt, dateRange.end)
      )
    )
    .groupBy(sql`DATE(${posts.createdAt})`)
    .orderBy(sql`DATE(${posts.createdAt})`);

  return trend;
}

export async function getTopPosts(userId: string, limit: number = 10) {
  // For Tier 1, just return most recent published posts
  // In Tier 2, this will be sorted by impressions/engagement
  return await db
    .select({
      id: posts.id,
      title: posts.title,
      status: posts.status,
      createdAt: posts.createdAt,
      scheduledAt: posts.scheduledAt,
      publishedAt: posts.publishedAt,
    })
    .from(posts)
    .where(
      and(
        eq(posts.userId, userId),
        eq(posts.status, "published")
      )
    )
    .orderBy(desc(posts.publishedAt))
    .limit(limit);
}

export async function getContentGenerationStats(userId: string) {
  const total = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(posts)
    .where(eq(posts.userId, userId));

  const byStatus = await db
    .select({
      status: posts.status,
      count: sql<number>`COUNT(*)`,
    })
    .from(posts)
    .where(eq(posts.userId, userId))
    .groupBy(posts.status);

  return {
    total: total[0]?.count ?? 0,
    byStatus: byStatus.reduce((acc, item) => {
      acc[item.status] = item.count;
      return acc;
    }, {} as Record<string, number>),
  };
}

export async function getSchedulingPatterns(userId: string) {
  const patterns = await db
    .select({
      dayOfWeek: sql<number>`EXTRACT(DOW FROM ${posts.scheduledAt})`,
      hour: sql<number>`EXTRACT(HOUR FROM ${posts.scheduledAt})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(posts)
    .where(
      and(
        eq(posts.userId, userId),
        isNotNull(posts.scheduledAt)
      )
    )
    .groupBy(
      sql`EXTRACT(DOW FROM ${posts.scheduledAt})`,
      sql`EXTRACT(HOUR FROM ${posts.scheduledAt})`
    );

  return patterns;
}
```

---

#### 9.3 — Create Analytics API Route

Create `src/app/api/analytics/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import {
  getPostsByStatus,
  getPublishingTrend,
  getTopPosts,
  getContentGenerationStats,
  getSchedulingPatterns,
  getDashboardStats,
  getPublishingSuccessRate,
} from "@/lib/db/queries";

function getDateRange(range: string) {
  const end = new Date();
  const start = new Date();

  switch (range) {
    case "7d":
      start.setDate(start.getDate() - 7);
      break;
    case "30d":
      start.setDate(start.getDate() - 30);
      break;
    case "90d":
      start.setDate(start.getDate() - 90);
      break;
    case "365d":
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      start.setDate(start.getDate() - 30);
  }

  return { start, end };
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId();
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "30d";
    const dateRange = getDateRange(range);

    const [
      stats,
      successRate,
      postsByStatus,
      publishingTrend,
      topPosts,
      generationStats,
      schedulingPatterns,
    ] = await Promise.all([
      getDashboardStats(userId),
      getPublishingSuccessRate(userId),
      getPostsByStatus(userId, dateRange),
      getPublishingTrend(userId, dateRange),
      getTopPosts(userId, 10),
      getContentGenerationStats(userId),
      getSchedulingPatterns(userId),
    ]);

    return NextResponse.json({
      range,
      summary: {
        totalPosts: stats.totalPosts,
        published: stats.published,
        successRate,
        aiGenerations: generationStats.total,
      },
      postsByStatus,
      publishingTrend,
      topPosts,
      generationStats,
      schedulingPatterns,
      linkedinConnected: false,
    });
  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 }
    );
  }
}
```

---

#### 9.4 — Build Analytics Page UI

**9.4.1 — Create `src/app/analytics/page.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { Sidebar } from "@/components/layout/sidebar";
import { AnalyticsHeader } from "@/components/analytics/analytics-header";
import { SummaryCards } from "@/components/analytics/summary-cards";
import { PublishingTrendChart } from "@/components/analytics/publishing-trend-chart";
import { ContentStatusBreakdown } from "@/components/analytics/content-status-breakdown";
import { TopPostsTable } from "@/components/analytics/top-posts-table";
import { SchedulingPatterns } from "@/components/analytics/scheduling-patterns";

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("30d");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const response = await fetch(`/api/analytics?range=${timeRange}`);
      const result = await response.json();
      setData(result);
      setLoading(false);
    }
    fetchData();
  }, [timeRange]);

  if (loading) {
    return (
      <AuroraBackground>
        <Sidebar />
        <main className="ml-64 p-8">
          <div className="glass-card p-8 rounded-3xl text-center">
            <p>Loading analytics...</p>
          </div>
        </main>
      </AuroraBackground>
    );
  }

  if (!data || data.summary.totalPosts === 0) {
    return (
      <AuroraBackground>
        <Sidebar />
        <main className="ml-64 p-8">
          <AnalyticsHeader timeRange={timeRange} onTimeRangeChange={setTimeRange} />
          <div className="glass-card p-12 rounded-3xl text-center mt-6">
            <span className="material-symbols-outlined text-6xl text-primary/40">
              insights
            </span>
            <h2 className="text-2xl font-bold mt-4">No Data Yet</h2>
            <p className="text-slate-500 mt-2">
              Create your first post to see analytics!
            </p>
          </div>
        </main>
      </AuroraBackground>
    );
  }

  return (
    <AuroraBackground>
      <Sidebar />
      <main className="ml-64 p-8" data-testid="analytics-page">
        <AnalyticsHeader timeRange={timeRange} onTimeRangeChange={setTimeRange} />

        <div className="mt-6 space-y-6">
          <SummaryCards summary={data.summary} />
          <PublishingTrendChart data={data.publishingTrend} />
          <ContentStatusBreakdown data={data.postsByStatus} />
          <TopPostsTable posts={data.topPosts} linkedinConnected={data.linkedinConnected} />
          <SchedulingPatterns patterns={data.schedulingPatterns} />
        </div>
      </main>
    </AuroraBackground>
  );
}
```

**9.4.2 — Create Analytics Components**

Create `src/components/analytics/analytics-header.tsx`:

```typescript
import { cn } from "@/lib/utils";

interface AnalyticsHeaderProps {
  timeRange: string;
  onTimeRangeChange: (range: string) => void;
}

export function AnalyticsHeader({ timeRange, onTimeRangeChange }: AnalyticsHeaderProps) {
  const ranges = [
    { value: "7d", label: "7 Days" },
    { value: "30d", label: "30 Days" },
    { value: "90d", label: "90 Days" },
    { value: "365d", label: "1 Year" },
  ];

  return (
    <div className="flex justify-between items-center">
      <h1 className="text-4xl font-bold">Analytics</h1>

      <div className="flex gap-2" data-testid="analytics-time-range">
        {ranges.map((range) => (
          <button
            key={range.value}
            data-testid={`analytics-range-${range.value}`}
            onClick={() => onTimeRangeChange(range.value)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-colors",
              timeRange === range.value
                ? "bg-primary text-white"
                : "bg-white/40 hover:bg-white/60"
            )}
          >
            {range.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

Create `src/components/analytics/summary-cards.tsx`:

```typescript
interface SummaryCardsProps {
  summary: {
    totalPosts: number;
    published: number;
    successRate: number;
    aiGenerations: number;
  };
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const cards = [
    {
      label: "Total Posts",
      value: summary.totalPosts.toString(),
      icon: "article",
      color: "orange",
    },
    {
      label: "Published",
      value: summary.published.toString(),
      icon: "check_circle",
      color: "blue",
    },
    {
      label: "Success Rate",
      value: `${summary.successRate}%`,
      icon: "bolt",
      color: "purple",
    },
    {
      label: "AI Generations",
      value: summary.aiGenerations.toString(),
      icon: "auto_awesome",
      color: "pink",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="glass-card p-6 rounded-3xl border border-white/50 shadow-sm"
          data-testid={`summary-card-${card.label.toLowerCase().replace(" ", "-")}`}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className={`material-symbols-outlined text-${card.color}-500`}>
              {card.icon}
            </span>
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              {card.label}
            </span>
          </div>
          <p className="text-3xl font-bold">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
```

Create `src/components/analytics/publishing-trend-chart.tsx`:

```typescript
import { cn } from "@/lib/utils";

interface PublishingTrendChartProps {
  data: Array<{ date: string; count: number }>;
}

export function PublishingTrendChart({ data }: PublishingTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="glass-card p-8 rounded-3xl border border-white/50 shadow-sm">
        <h3 className="text-xl font-bold mb-4">Publishing Trend</h3>
        <p className="text-slate-400">No publishing data yet</p>
      </div>
    );
  }

  const maxCount = Math.max(...data.map(d => d.count));

  return (
    <div className="glass-card p-8 rounded-3xl border border-white/50 shadow-sm">
      <h3 className="text-xl font-bold mb-6">Publishing Trend</h3>

      <div className="h-48 w-full flex items-end justify-between gap-1">
        {data.map((point, index) => {
          const height = maxCount > 0 ? (point.count / maxCount) * 100 : 0;
          return (
            <div
              key={index}
              className="flex-1 bg-primary/20 rounded-t-lg hover:bg-primary/40 transition-colors"
              style={{ height: `${height}%` }}
              title={`${point.date}: ${point.count} posts`}
            />
          );
        })}
      </div>

      <div className="flex justify-between mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        <span>{data[0]?.date}</span>
        <span>{data[Math.floor(data.length / 2)]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}
```

Create `src/components/analytics/content-status-breakdown.tsx`:

```typescript
interface ContentStatusBreakdownProps {
  data: Array<{ status: string; count: number }>;
}

export function ContentStatusBreakdown({ data }: ContentStatusBreakdownProps) {
  const statusColors = {
    draft: "bg-gray-400",
    scheduled: "bg-blue-500",
    published: "bg-green-500",
    failed: "bg-red-500",
  };

  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="glass-card p-8 rounded-3xl border border-white/50 shadow-sm">
      <h3 className="text-xl font-bold mb-6">Content Status</h3>

      <div className="space-y-4">
        {data.map((item) => {
          const percentage = total > 0 ? (item.count / total) * 100 : 0;
          return (
            <div key={item.status}>
              <div className="flex justify-between mb-2">
                <span className="font-bold capitalize">{item.status}</span>
                <span className="text-slate-500">{item.count} posts ({percentage.toFixed(1)}%)</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className={statusColors[item.status as keyof typeof statusColors]}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

Create `src/components/analytics/top-posts-table.tsx`:

```typescript
import { format } from "date-fns";

interface TopPostsTableProps {
  posts: Array<{
    id: string;
    title: string;
    status: string;
    publishedAt: Date | null;
  }>;
  linkedinConnected: boolean;
}

export function TopPostsTable({ posts, linkedinConnected }: TopPostsTableProps) {
  if (posts.length === 0) {
    return (
      <div className="glass-card p-8 rounded-3xl border border-white/50 shadow-sm">
        <h3 className="text-xl font-bold mb-4">Top Posts</h3>
        <p className="text-slate-400">No published posts yet</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-8 rounded-3xl border border-white/50 shadow-sm">
      <h3 className="text-xl font-bold mb-6">Top Posts</h3>

      {!linkedinConnected && (
        <p className="text-sm text-slate-500 mb-4">
          Connect LinkedIn to see impressions and engagement data
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left border-b border-white/20">
              <th className="pb-3 font-bold text-sm">Title</th>
              <th className="pb-3 font-bold text-sm">Published</th>
              <th className="pb-3 font-bold text-sm">Status</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} className="border-b border-white/10">
                <td className="py-3">{post.title}</td>
                <td className="py-3 text-slate-500">
                  {post.publishedAt ? format(new Date(post.publishedAt), "MMM d, yyyy") : "—"}
                </td>
                <td className="py-3">
                  <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                    {post.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

Create `src/components/analytics/scheduling-patterns.tsx`:

```typescript
interface SchedulingPatternsProps {
  patterns: Array<{
    dayOfWeek: number;
    hour: number;
    count: number;
  }>;
}

export function SchedulingPatterns({ patterns }: SchedulingPatternsProps) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Group by day of week
  const byDay = patterns.reduce((acc, pattern) => {
    const day = days[pattern.dayOfWeek] || "Unknown";
    acc[day] = (acc[day] || 0) + pattern.count;
    return acc;
  }, {} as Record<string, number>);

  const maxCount = Math.max(...Object.values(byDay), 1);

  return (
    <div className="glass-card p-8 rounded-3xl border border-white/50 shadow-sm">
      <h3 className="text-xl font-bold mb-6">Scheduling Patterns</h3>

      {Object.keys(byDay).length === 0 ? (
        <p className="text-slate-400">No scheduled posts yet</p>
      ) : (
        <div className="space-y-4">
          {days.map((day) => {
            const count = byDay[day] || 0;
            const percentage = (count / maxCount) * 100;
            return (
              <div key={day}>
                <div className="flex justify-between mb-2">
                  <span className="font-bold">{day}</span>
                  <span className="text-slate-500">{count} posts</span>
                </div>
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="bg-primary h-full"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

---

#### 9.5 — Handle Empty State

Already implemented in the page and components above with conditional rendering.

---

#### 9.6 — Use CSS-Only Charts

All charts use pure CSS (height percentages, flex layout) consistent with the existing dashboard design.

---

### Tier 1 Verification Checklist

- [ ] Analytics link works in sidebar and navigates to `/analytics`
- [ ] Page renders with existing design language (Aurora background, glass cards)
- [ ] Time range selector (7d/30d/90d/1y) works and re-fetches data
- [ ] Summary cards show real counts from database
- [ ] Publishing trend chart renders with real data
- [ ] Content status breakdown shows distribution of draft/scheduled/published/failed
- [ ] Top posts table lists actual posts from database
- [ ] Scheduling patterns show preferred days/times
- [ ] New user sees empty state ("No data yet")
- [ ] User-scoped data (each user sees only their own)
- [ ] All elements have `data-testid` attributes
- [ ] Page is responsive on mobile

---

## Tier 2: LinkedIn API Analytics

> **Note**: Analytics scopes (`r_member_postAnalytics`, `r_member_profileAnalytics`) are RESTRICTED and require LinkedIn Community Management API approval. Same approval as Phase 8 Tier 2.

### Step-by-Step Plan

#### 9.7 — Add LinkedIn Engagement Data to Analytics

Update `src/app/api/analytics/route.ts` to include LinkedIn data:

```typescript
// After fetching database data...

// Check if LinkedIn is connected (same pattern as Phase 8)
const settings = await getUserSettings(userId);

if (settings?.linkedinOauthStatus === "connected" && settings.linkedinAccessToken) {
  try {
    const accessToken = await decrypt(settings.linkedinAccessToken);
    const client = new LinkedInApiClient(accessToken);

    // Fetch LinkedIn analytics for top posts
    const postsWithLinkedInData = await Promise.all(
      topPosts.map(async (post) => {
        if (post.linkedinPostUrn) {
          const analytics = await client.getPostAnalytics(post.linkedinPostUrn);
          return {
            ...post,
            impressions: analytics.impressions,
            reactions: analytics.reactions,
            comments: analytics.comments,
            engagementRate: calculateEngagementRate(analytics),
          };
        }
        return post;
      })
    );

    return NextResponse.json({
      // ... existing data
      linkedinConnected: true,
      topPosts: postsWithLinkedInData,
    });
  } catch (error) {
    console.error("LinkedIn API error:", error);
    // Continue without LinkedIn data
  }
}
```

Helper function:

```typescript
function calculateEngagementRate(analytics: {
  impressions: number;
  reactions: number;
  comments: number;
}) {
  if (analytics.impressions === 0) return 0;
  const engagement = analytics.reactions + analytics.comments;
  return ((engagement / analytics.impressions) * 100).toFixed(2);
}
```

---

#### 9.8 — Add "Connect LinkedIn" Prompt

Update `src/components/analytics/top-posts-table.tsx` to show additional columns when LinkedIn is connected:

```typescript
export function TopPostsTable({ posts, linkedinConnected }: TopPostsTableProps) {
  // ... existing code

  return (
    <div className="glass-card p-8 rounded-3xl border border-white/50 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold">Top Posts</h3>

        {!linkedinConnected && (
          <form action="/api/linkedin/connect" method="POST">
            <button className="text-sm font-bold text-primary hover:underline">
              Connect LinkedIn for full analytics
            </button>
          </form>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left border-b border-white/20">
              <th className="pb-3 font-bold text-sm">Title</th>
              <th className="pb-3 font-bold text-sm">Published</th>
              {linkedinConnected && (
                <>
                  <th className="pb-3 font-bold text-sm">Impressions</th>
                  <th className="pb-3 font-bold text-sm">Engagement</th>
                  <th className="pb-3 font-bold text-sm">Rate</th>
                </>
              )}
              <th className="pb-3 font-bold text-sm">Status</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} className="border-b border-white/10">
                <td className="py-3">{post.title}</td>
                <td className="py-3 text-slate-500">
                  {post.publishedAt ? format(new Date(post.publishedAt), "MMM d, yyyy") : "—"}
                </td>
                {linkedinConnected && (
                  <>
                    <td className="py-3">{post.impressions?.toLocaleString() || "—"}</td>
                    <td className="py-3">{(post.reactions + post.comments) || "—"}</td>
                    <td className="py-3">{post.engagementRate ? `${post.engagementRate}%` : "—"}</td>
                  </>
                )}
                <td className="py-3">
                  <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                    {post.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

#### 9.9 — Add Caching

Use the same caching approach from Phase 8:

```typescript
import { getCached, setCache } from "@/lib/cache";

export async function GET(request: NextRequest) {
  const userId = await getAuthUserId();
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") || "30d";

  const cacheKey = `analytics:${userId}:${range}`;
  const cached = getCached(cacheKey);
  if (cached) return NextResponse.json(cached);

  // ... fetch data
  const response = { /* ... */ };

  setCache(cacheKey, response, 15 * 60 * 1000); // 15 minutes
  return NextResponse.json(response);
}
```

---

### Tier 2 Verification Checklist

- [ ] LinkedIn data appears alongside DB data when connected
- [ ] Impressions column shows real data from LinkedIn API
- [ ] Engagement rate calculated correctly (reactions + comments) / impressions
- [ ] Top posts can be sorted by impressions (if implemented)
- [ ] "Connect LinkedIn" prompt shows when not connected
- [ ] All elements have `data-testid` attributes
- [ ] Responsive on mobile
- [ ] Caching prevents excessive API calls (15-minute TTL)
- [ ] Error handling for expired tokens, API errors, rate limits

---

## Important Notes

**LinkedIn API Data Retention**:
- Post analytics: 60 days only
- Follower data: 12 months

**Future Enhancement**: Store/cache LinkedIn historical data locally in the database if long-term trending is desired. This is not a blocker for Phase 9 completion.

**Build Order**:
1. Build Tier 1 first and verify it works
2. Once LinkedIn Community Management API is approved, build Tier 2
3. Tier 2 reuses the OAuth flow from Phase 8 Tier 2 (no additional OAuth implementation needed)

---

## LinkedIn API Endpoints Used (Tier 2)

```
GET /rest/memberCreatorPostAnalytics?q=me&queryType=IMPRESSION&aggregation=DAILY
GET /rest/memberCreatorPostAnalytics?q=me&queryType=REACTION&aggregation=TOTAL
GET /rest/memberCreatorPostAnalytics?q=me&queryType=COMMENT&aggregation=TOTAL
```

**Required Scopes**: `r_member_postAnalytics`, `r_member_profileAnalytics`

**Required Headers**:
```
Authorization: Bearer {TOKEN}
LinkedIn-Version: 202601
X-Restli-Protocol-Version: 2.0.0
```
