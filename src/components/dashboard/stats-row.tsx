import { getDashboardStats } from "@/lib/queries/stats";
import { StatCard } from "./stat-card";

export async function StatsRow() {
  const stats = await getDashboardStats();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6" data-testid="dashboard-stats-row">
      {stats.cards.map((card) => (
        <StatCard
          key={card.label}
          data-testid={`dashboard-stat-${card.label.toLowerCase().replace(/\s+/g, '-')}`}
          {...card}
        />
      ))}
    </div>
  );
}
