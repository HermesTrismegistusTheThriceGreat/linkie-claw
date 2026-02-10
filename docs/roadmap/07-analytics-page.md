# Phase 7: Analytics Page — Deep LinkedIn Insights

## Goal
Build a dedicated Analytics page with charts, graphs, and tables showing detailed LinkedIn performance data. Connect the existing disabled sidebar link.

## Done When
A logged-in user can navigate to the Analytics page from the sidebar and see detailed charts and breakdowns of their LinkedIn performance using real API data.

## Depends On
Phase 6 (LinkedIn API client and dashboard patterns established)

---

## Step-by-Step Plan

### 7.1 — Enable the Sidebar Link

In `src/components/layout/sidebar.tsx`:
```diff
-  { href: "/analytics", icon: "insights", label: "Analytics", disabled: true },
+  { href: "/analytics", icon: "insights", label: "Analytics" },
```

---

### 7.2 — Research All Available LinkedIn API Data

Based on LinkedIn API documentation (2025 versioned API):

| Category | Data Points | Endpoint |
|----------|------------|----------|
| **Post Metrics** | Impressions, unique impressions, clicks, likes, comments, shares, engagement rate | `organizationalEntityShareStatistics` |
| **Profile Views** | Total profile views over time | Limited to company pages |
| **Follower Demographics** | By geography, industry, company size, seniority, function | `organizationalEntityFollowerStatistics` |
| **Engagement Trends** | Daily/weekly/monthly engagement over time | Aggregated from share statistics |
| **Content Comparisons** | Performance of individual posts ranked by metric | Aggregated from per-post stats |
| **Follower Growth** | Net new followers per day/week/month | `organizationalEntityFollowerStatistics` with time filter |

---

### 7.3 — Create Analytics API Route

#### 7.3.1 — `src/app/api/analytics/route.ts`

```typescript
export async function GET(request: NextRequest) {
  const userId = await getAuthUserId();
  const { searchParams } = new URL(request.url);
  const timeRange = searchParams.get("range") || "30d"; // 7d, 30d, 90d, 365d
  
  const settings = await getUserSettings(userId);
  if (settings?.linkedin_oauth_status !== "connected") {
    return NextResponse.json({ connected: false });
  }
  
  const client = new LinkedInApiClient(await getValidToken(userId), settings.linkedin_person_urn);
  
  const [
    postMetrics,
    followerDemographics,
    engagementTrend,
    topPosts,
    followerGrowth,
  ] = await Promise.allSettled([
    client.getPostMetrics(timeRange),
    client.getFollowerDemographics(),
    client.getEngagementTrend(timeRange),
    client.getTopPosts(10, timeRange),
    client.getFollowerGrowth(timeRange),
  ]);
  
  return NextResponse.json({
    connected: true,
    timeRange,
    data: {
      postMetrics: resolveOrDefault(postMetrics, {}),
      followerDemographics: resolveOrDefault(followerDemographics, {}),
      engagementTrend: resolveOrDefault(engagementTrend, []),
      topPosts: resolveOrDefault(topPosts, []),
      followerGrowth: resolveOrDefault(followerGrowth, []),
    },
  });
}
```

---

### 7.4 — Build Analytics Page UI

#### 7.4.1 — Create `src/app/analytics/page.tsx`

Page structure matching existing design:
```
Analytics Page
├── AuroraBackground + Sidebar
├── Header: "Analytics" with time range selector (7d / 30d / 90d / 1y)
├── Row: Summary Cards (4 cards)
│   ├── Total Impressions
│   ├── Average Engagement Rate  
│   ├── Total Profile Views
│   └── Post Count
├── Section: Engagement Trend Chart (line/area chart, 30-day sparkline)
├── Section: Follower Growth Chart (bar chart similar to dashboard)
├── Section: Top Performing Posts (table/cards)
│   └── Columns: Title, Date, Impressions, Engagement, Clicks
├── Section: Follower Demographics (pie/donut charts)
│   ├── By Industry
│   ├── By Geography
│   └── By Seniority
└── Section: Content Performance Comparison
    └── Horizontal bar chart comparing post types/topics
```

#### 7.4.2 — Create analytics components

Create `src/components/analytics/` directory:
- `analytics-header.tsx` — Title + time range toggle
- `summary-cards.tsx` — 4 stat cards in a row
- `engagement-trend-chart.tsx` — Line/area chart
- `follower-growth-chart.tsx` — Bar chart (reuse pattern from dashboard)
- `top-posts-table.tsx` — Sortable table of best-performing posts
- `demographics-charts.tsx` — Pie/donut charts for follower segments
- `content-comparison.tsx` — Horizontal bar chart

#### 7.4.3 — Chart rendering approach

Use CSS-only charts (consistent with the existing `follower-chart.tsx` which uses pure CSS bars):

```tsx
// Bar chart pattern (already used in the app):
<div className="flex items-end gap-1">
  {data.map((point, i) => (
    <div
      key={i}
      className="flex-1 bg-primary/20 rounded-t-lg"
      style={{ height: `${(point.value / maxValue) * 100}%` }}
    />
  ))}
</div>

// For more complex charts, consider adding a lightweight charting library:
// Option 1: recharts (React-native, composable)
// Option 2: chart.js with react-chartjs-2
// Option 3: Continue with pure CSS (simpler, no new dependency)
```

> **Recommendation:** Start with CSS-only charts for consistency. If the user requests more sophisticated visualizations, add `recharts` as a dependency.

#### 7.4.4 — Time range selector

```tsx
<div className="flex gap-2" data-testid="analytics-time-range">
  {["7d", "30d", "90d", "1y"].map((range) => (
    <button
      key={range}
      data-testid={`analytics-range-${range}`}
      onClick={() => setTimeRange(range)}
      className={cn(
        "px-4 py-2 rounded-lg text-sm font-bold",
        activeRange === range ? "bg-primary text-white" : "bg-white/40"
      )}
    >
      {range === "7d" ? "7 Days" : range === "30d" ? "30 Days" : range === "90d" ? "90 Days" : "1 Year"}
    </button>
  ))}
</div>
```

---

### 7.5 — Handle "Not Connected" State

When LinkedIn is not connected, show a full-page prompt:
```tsx
<div className="glass-card p-12 text-center">
  <span className="material-symbols-outlined text-6xl text-primary/40">insights</span>
  <h2>Connect LinkedIn to See Analytics</h2>
  <p>Link your LinkedIn account in Settings to unlock detailed performance insights.</p>
  <Link href="/settings" className="btn-primary">Go to Settings</Link>
</div>
```

---

### 7.6 — Add Caching to Analytics Data

Reuse the caching pattern from Phase 6:
- Cache per user + time range
- 15-minute TTL
- Show "Last updated" timestamp
- Manual refresh button

---

## Verification Checklist

- [ ] Analytics sidebar link is active and navigates to `/analytics`
- [ ] Analytics page renders with the Aurora/glass design system
- [ ] Time range selector (7d/30d/90d/1y) works and re-fetches data
- [ ] Summary cards show real impressions, engagement, views, post count
- [ ] Engagement trend chart renders with daily data points
- [ ] Follower growth chart shows real follower changes
- [ ] Top posts table lists posts sorted by impressions
- [ ] Follower demographics charts show industry/geography/seniority breakdown
- [ ] "Not Connected" state shows a clear prompt with link to Settings
- [ ] Data is user-scoped (each user sees only their own)
- [ ] All elements have `data-testid` attributes
- [ ] Page is responsive on mobile
