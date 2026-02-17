import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth-utils";
import {
  getPostsByStatus,
  getPublishingTrend,
  getTopPosts,
  getContentGenerationStats,
  getSchedulingPatterns,
  getDashboardStats,
  getPublishingSuccessRate,
} from "@/lib/db/queries";

/**
 * GET /api/analytics?range=30d
 * Fetch analytics data for the current user
 * Query params:
 *   - range: 7d | 30d | 90d | 365d (default: 30d)
 */
export async function GET(request: Request) {
  try {
    const userId = await getAuthUserId();

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "30d";

    // Parse range to days
    const rangeMap: Record<string, number> = {
      "7d": 7,
      "30d": 30,
      "90d": 90,
      "365d": 365,
    };
    const days = rangeMap[range] || 30;

    const [
      stats,
      successRate,
      postsByStatus,
      publishingTrend,
      topPosts,
      contentStats,
      schedulingPatterns,
    ] = await Promise.all([
      getDashboardStats(userId),
      getPublishingSuccessRate(userId),
      getPostsByStatus(userId, days),
      getPublishingTrend(userId, days),
      getTopPosts(userId, 10),
      getContentGenerationStats(userId, days),
      getSchedulingPatterns(userId, days),
    ]);

    return NextResponse.json({
      summary: {
        totalPosts: stats.totalPosts,
        published: stats.published,
        successRate,
        aiGenerations: contentStats.totalGenerations,
      },
      postsByStatus,
      publishingTrend,
      topPosts,
      schedulingPatterns,
      contentStats,
    });
  } catch (error) {
    console.error("Analytics API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 }
    );
  }
}
