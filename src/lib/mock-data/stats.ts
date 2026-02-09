import type { DashboardStats, FollowerDataPoint } from "@/types/stats";

// Generate 30 days of follower growth data
function generateFollowerGrowth(): FollowerDataPoint[] {
  const data: FollowerDataPoint[] = [];
  const baseDate = new Date("2024-11-01");

  for (let i = 0; i < 30; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);

    // Generate varied daily gains between 50-200
    const count = Math.floor(Math.random() * 150) + 50;

    data.push({
      date: date.toISOString().split("T")[0]!,
      count,
    });
  }

  return data;
}

export const mockStats: DashboardStats = {
  cards: [
    {
      label: "Post Reach",
      value: "45.2K",
      change: 12.4,
      changeLabel: "+12.4%",
      icon: "visibility",
      color: "orange",
    },
    {
      label: "Engagement Rate",
      value: "5.8%",
      change: 0.5,
      changeLabel: "+0.5%",
      icon: "bolt",
      color: "purple",
    },
    {
      label: "New Followers",
      value: "1,284",
      change: 22.1,
      changeLabel: "+22.1%",
      icon: "group_add",
      color: "blue",
    },
  ],
  totalFollowers: 24847,
  followerGrowth: generateFollowerGrowth(),
};

// Chart bar heights for the follower chart (percentages)
export const mockChartHeights = [
  40, 55, 45, 70, 65, 85, 75, 60, 90, 80, 95, 100,
];
