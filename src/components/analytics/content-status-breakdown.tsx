interface PostByStatus {
  date: string;
  status: string;
  count: number;
}

interface ContentStatusBreakdownProps {
  data: PostByStatus[];
}

export function ContentStatusBreakdown({ data }: ContentStatusBreakdownProps) {
  // Aggregate by status
  const statusCounts = data.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + item.count;
    return acc;
  }, {});

  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  const statusConfig: Record<
    string,
    { label: string; color: string; bgColor: string }
  > = {
    draft: {
      label: "Drafts",
      color: "text-yellow-600",
      bgColor: "bg-yellow-500",
    },
    scheduled: {
      label: "Scheduled",
      color: "text-blue-600",
      bgColor: "bg-blue-500",
    },
    published: {
      label: "Published",
      color: "text-green-600",
      bgColor: "bg-green-500",
    },
    failed: {
      label: "Failed",
      color: "text-red-600",
      bgColor: "bg-red-500",
    },
    publishing: {
      label: "Publishing",
      color: "text-purple-600",
      bgColor: "bg-purple-500",
    },
  };

  return (
    <div
      data-testid="analytics-status-breakdown"
      className="glass-card rounded-2xl p-6 border border-white/50"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold">Content Status</h2>
          <p className="text-sm text-muted-foreground">
            Breakdown by post status
          </p>
        </div>
        <span className="material-symbols-outlined text-muted-foreground">
          donut_large
        </span>
      </div>

      <div className="space-y-4">
        {Object.entries(statusConfig).map(([status, config]) => {
          const count = statusCounts[status] || 0;
          const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

          return (
            <div key={status} data-testid={`analytics-status-${status}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${config.bgColor}`}
                  />
                  <span className="text-sm font-medium">{config.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{count}</span>
                  <span className="text-xs text-muted-foreground">
                    ({percentage}%)
                  </span>
                </div>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${config.bgColor} rounded-full transition-all duration-500`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total Posts</span>
          <span className="text-xl font-bold">{total}</span>
        </div>
      </div>
    </div>
  );
}
