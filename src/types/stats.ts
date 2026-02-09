export interface StatCard {
  label: string;
  value: string;
  change: number;
  changeLabel: string;
  icon: string;
  color: "orange" | "purple" | "blue";
}

export interface FollowerDataPoint {
  date: string;
  count: number;
}

export interface DashboardStats {
  cards: StatCard[];
  followerGrowth: FollowerDataPoint[];
  totalFollowers: number;
}
