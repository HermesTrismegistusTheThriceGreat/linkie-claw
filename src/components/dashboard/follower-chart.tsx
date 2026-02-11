import { getDashboardStats } from "@/lib/queries/stats";
import { mockChartHeights } from "@/lib/mock-data/stats";
import { cn } from "@/lib/utils";

function formatFollowerCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toLocaleString();
}

export async function FollowerChart() {
  const stats = await getDashboardStats();
  const totalFollowers = stats.totalFollowers;

  return (
    <div data-testid="dashboard-follower-chart" className="glass-card p-8 rounded-3xl border border-white/50 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold">Follower Growth</h2>
          <p className="text-sm text-slate-500 font-medium">
            Total: {formatFollowerCount(totalFollowers)} followers
          </p>
        </div>
        <select data-testid="dashboard-chart-time-range" className="bg-transparent border-none text-sm font-bold focus:ring-0 cursor-pointer" aria-label="Time range">
          <option>Last 30 Days</option>
          <option>Last 7 Days</option>
          <option>Last 6 Months</option>
        </select>
      </div>

      <div className="h-48 w-full flex items-end justify-between gap-1 relative">
        {mockChartHeights.map((height, index) => {
          const isPeak = height > 80;
          return (
            <div
              key={index}
              className={cn(
                "flex-1 rounded-t-lg transition-colors",
                isPeak
                  ? "bg-primary/40 border-t-2 border-primary hover:bg-primary/50"
                  : "bg-primary/20 hover:bg-primary/40"
              )}
              style={{ height: `${height}%` }}
            />
          );
        })}
      </div>

      <div className="flex justify-between mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">
        <span>1 Nov</span>
        <span>15 Nov</span>
        <span>30 Nov</span>
      </div>
    </div>
  );
}
