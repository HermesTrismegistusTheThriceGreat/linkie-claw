import { mockStats, mockChartHeights } from "@/lib/mock-data/stats";
import type { DashboardStats, StatCard, FollowerDataPoint } from "@/types/stats";

export async function getDashboardStats(): Promise<DashboardStats> {
  // Simulate async DB call
  await new Promise((resolve) => setTimeout(resolve, 100));
  return mockStats;
}

export async function getStatCards(): Promise<StatCard[]> {
  await new Promise((resolve) => setTimeout(resolve, 50));
  return mockStats.cards;
}

export async function getFollowerGrowth(): Promise<FollowerDataPoint[]> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  return mockStats.followerGrowth;
}

export async function getTotalFollowers(): Promise<number> {
  await new Promise((resolve) => setTimeout(resolve, 50));
  return mockStats.totalFollowers;
}

export async function getChartHeights(): Promise<number[]> {
  await new Promise((resolve) => setTimeout(resolve, 50));
  return mockChartHeights;
}
