"use client";

import { useState } from "react";
import { AuroraBackground } from "@/components/layout/aurora-background";
import { Sidebar } from "@/components/layout/sidebar";
import { AnalyticsHeader } from "@/components/analytics/analytics-header";
import { SummaryCards } from "@/components/analytics/summary-cards";
import { PublishingTrendChart } from "@/components/analytics/publishing-trend-chart";
import { ContentStatusBreakdown } from "@/components/analytics/content-status-breakdown";
import { TopPostsTable } from "@/components/analytics/top-posts-table";
import { SchedulingPatterns } from "@/components/analytics/scheduling-patterns";
import { useAnalyticsData } from "@/hooks/use-analytics-data";

const timeRanges = ["7d", "30d", "90d", "365d"] as const;
type TimeRange = (typeof timeRanges)[number];

export default function AnalyticsPage() {
  const [range, setRange] = useState<TimeRange>("30d");
  const { data, isLoading, error } = useAnalyticsData(range);

  return (
    <AuroraBackground className="min-h-screen">
      <div className="flex" data-testid="page-analytics">
        <Sidebar />
        <main className="flex-1 overflow-y-auto z-10">
          <div className="max-w-7xl mx-auto p-10 space-y-8">
            <AnalyticsHeader
              currentRange={range}
              onRangeChange={setRange}
              ranges={timeRanges}
            />

            {isLoading ? (
              <div
                data-testid="analytics-loading"
                className="flex items-center justify-center py-20"
              >
                <div className="text-center">
                  <div className="size-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Loading analytics data...
                  </p>
                </div>
              </div>
            ) : error ? (
              <div
                data-testid="analytics-error"
                className="flex items-center justify-center py-20"
              >
                <div className="text-center">
                  <span className="material-symbols-outlined text-4xl text-red-500 mb-2">
                    error
                  </span>
                  <p className="text-red-500">Failed to load analytics data</p>
                  <p className="text-sm text-muted-foreground mt-1">{error}</p>
                </div>
              </div>
            ) : data && data.summary.totalPosts === 0 ? (
              <div
                data-testid="analytics-empty"
                className="flex items-center justify-center py-20"
              >
                <div className="text-center glass-card p-12 rounded-2xl">
                  <span className="material-symbols-outlined text-6xl text-primary/50 mb-4">
                    insights
                  </span>
                  <h2 className="text-2xl font-bold mb-2">No Data Yet</h2>
                  <p className="text-muted-foreground max-w-md mb-6">
                    Start creating and publishing content to see analytics here.
                    Your posting activity, success rates, and scheduling
                    patterns will appear once you have some posts.
                  </p>
                  <a
                    href="/create"
                    data-testid="analytics-btn-create-first"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/25 hover:scale-[1.02] active:scale-95 transition-transform"
                  >
                    <span className="material-symbols-outlined">add</span>
                    <span>Create Your First Post</span>
                  </a>
                </div>
              </div>
            ) : data ? (
              <>
                <SummaryCards data={data.summary} />
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  <PublishingTrendChart
                    data={data.publishingTrend}
                    days={parseInt(range)}
                  />
                  <ContentStatusBreakdown data={data.postsByStatus} />
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  <TopPostsTable posts={data.topPosts} />
                  <SchedulingPatterns data={data.schedulingPatterns} />
                </div>
              </>
            ) : null}
          </div>
        </main>
      </div>
    </AuroraBackground>
  );
}
