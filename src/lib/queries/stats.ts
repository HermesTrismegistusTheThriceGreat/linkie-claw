import type { DashboardStats, StatCard, FollowerDataPoint } from "@/types/stats";

import {
  getDashboardStats as getDbDashboardStats,
  getPublishingSuccessRate,
  getPostsOverTime,
  getGenerationCount,
} from "@/lib/db/queries";
import { getAuthUserId } from "@/lib/auth-utils";

export async function getDashboardStats(): Promise<DashboardStats> {
  const userId = await getAuthUserId();

  const [dbStats, successRate, postsOverTime, generationCount] =
    await Promise.all([
      getDbDashboardStats(userId),
      getPublishingSuccessRate(userId),
      getPostsOverTime(userId, 30),
      getGenerationCount(userId),
    ]);

  // Transform database data into dashboard format
  const cards: StatCard[] = [
    {
      label: "Total Posts",
      value: dbStats.totalPosts.toString(),
      change: 0, // Can calculate week-over-week change if needed
      changeLabel: "",
      icon: "article",
      color: "orange",
    },
    {
      label: "Success Rate",
      value: `${successRate}%`,
      change: 0,
      changeLabel: "",
      icon: "bolt",
      color: "purple",
    },
    {
      label: "Published",
      value: dbStats.published.toString(),
      change: 0,
      changeLabel: "",
      icon: "check_circle",
      color: "blue",
    },
  ];

  // Transform posts over time into chart data
  const followerGrowth: FollowerDataPoint[] = postsOverTime.map((point: { date: string; count: number }) => ({
    date: point.date,
    count: point.count,
  }));

  return {
    cards,
    followerGrowth,
    totalFollowers: generationCount, // Use generation count as total posts count
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
  return stats.totalFollowers;
}

export async function getChartHeights(): Promise<number[]> {
  const growth = await getFollowerGrowth();
  if (growth.length === 0) return [];

  const maxCount = Math.max(...growth.map((d) => d.count));
  return growth.map((d) => Math.round((d.count / maxCount) * 100));
}
