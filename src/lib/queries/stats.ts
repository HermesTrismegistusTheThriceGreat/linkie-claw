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
  const followerGrowth: FollowerDataPoint[] = data.postsOverTime.map((point: { date: string; count: number }) => ({
    date: point.date,
    count: point.count,
  }));

  return {
    cards,
    followerGrowth,
    totalFollowers: data.generationCount, // Use generation count as total posts count
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
