import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth-utils";
import {
  getDashboardStats,
  getPublishingSuccessRate,
  getPostsOverTime,
  getRecentPosts,
  getGenerationCount,
} from "@/lib/db/queries";

/**
 * GET /api/dashboard
 * Fetch aggregated dashboard stats for the current user
 */
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
