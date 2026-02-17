interface SchedulingPattern {
  day: string;
  count: number;
}

interface SchedulingPatternsProps {
  data: SchedulingPattern[];
}

export function SchedulingPatterns({ data }: SchedulingPatternsProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  // Ensure all days are represented
  const allDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayMap = new Map(data.map((d) => [d.day, d.count]));

  const fullData = allDays.map((day) => ({
    day,
    count: dayMap.get(day) || 0,
  }));

  // Find preferred day
  const preferredDay = fullData.length > 0
    ? fullData.reduce(
        (max, current) => (current.count > max.count ? current : max),
        fullData[0]!
      )
    : null;

  return (
    <div
      data-testid="analytics-scheduling-patterns"
      className="glass-card rounded-2xl p-6 border border-white/50"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold">Scheduling Patterns</h2>
          <p className="text-sm text-muted-foreground">
            Preferred posting days
          </p>
        </div>
        <span className="material-symbols-outlined text-muted-foreground">
          calendar_month
        </span>
      </div>

      <div className="flex items-end gap-3 h-40 mb-4">
        {fullData.map((item) => {
          const heightPercent = (item.count / maxCount) * 100;
          const isPreferred = preferredDay && item.day === preferredDay.day && item.count > 0;

          return (
            <div
              key={item.day}
              data-testid={`analytics-day-${item.day}`}
              className="flex-1 flex flex-col items-center gap-2"
            >
              <div className="relative w-full flex items-end justify-center h-32">
                <div
                  className={`w-full rounded-t-lg transition-all ${
                    isPreferred
                      ? "bg-primary"
                      : "bg-primary/20 hover:bg-primary/40"
                  }`}
                  style={{ height: `${Math.max(heightPercent, 5)}%` }}
                />
                {item.count > 0 && (
                  <span className="absolute -top-5 text-xs font-semibold">
                    {item.count}
                  </span>
                )}
              </div>
              <span
                className={`text-xs font-medium ${
                  isPreferred ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {item.day}
              </span>
            </div>
          );
        })}
      </div>

      {preferredDay && preferredDay.count > 0 && (
        <div className="p-4 bg-primary/10 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">
              star
            </span>
            <span className="text-sm">
              <strong>Most active day:</strong> {preferredDay.day} (
              {preferredDay.count} posts)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
