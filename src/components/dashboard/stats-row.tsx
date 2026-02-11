import { getDashboardStats } from "@/lib/queries/stats";
import { StatCard } from "./stat-card";

export async function StatsRow() {
  const stats = await getDashboardStats();

  if (stats.cards.length === 0) {
    return (
      <div className="glass-card p-8 rounded-3xl text-center" data-testid="dashboard-stats-empty">
        <p className="text-slate-500">Create your first post to see stats!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6" data-testid="dashboard-stats-row">
      {stats.cards.map((card) => (
        <StatCard
          key={card.label}
          data-testid={`dashboard-stat-${card.label.toLowerCase().replace(/\s+/g, "-")}`}
          {...card}
        />
      ))}
    </div>
  );
}
