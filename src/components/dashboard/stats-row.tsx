import { getDashboardStats } from "@/lib/queries/stats";
import { StatCard } from "./stat-card";

export async function StatsRow() {
  const stats = await getDashboardStats();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {stats.cards.map((card) => (
        <StatCard key={card.label} {...card} />
      ))}
    </div>
  );
}
