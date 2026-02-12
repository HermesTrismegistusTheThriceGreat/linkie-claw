interface PublishingTrendItem {
  date: string;
  count: number;
}

interface PublishingTrendChartProps {
  data: PublishingTrendItem[];
  days: number;
}

export function PublishingTrendChart({
  data,
  days,
}: PublishingTrendChartProps) {
  // Fill in missing dates with 0 counts
  const filledData = fillMissingDates(data, days);
  const maxCount = Math.max(...filledData.map((d) => d.count), 1);

  return (
    <div
      data-testid="analytics-publishing-trend"
      className="glass-card rounded-2xl p-6 border border-white/50"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold">Publishing Trend</h2>
          <p className="text-sm text-muted-foreground">
            Posts published over time
          </p>
        </div>
        <span className="material-symbols-outlined text-muted-foreground">
          trending_up
        </span>
      </div>

      <div className="h-48 flex items-end gap-1">
        {filledData.map((item, index) => {
          const heightPercent = (item.count / maxCount) * 100;
          const date = new Date(item.date);
          const dayLabel = date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });

          return (
            <div
              key={item.date}
              className="flex-1 flex flex-col items-center gap-1 group"
              title={`${dayLabel}: ${item.count} posts`}
            >
              <div className="relative w-full flex items-end justify-center">
                <div
                  className="w-full bg-primary/20 rounded-t-sm group-hover:bg-primary/40 transition-all"
                  style={{ height: `${heightPercent}%` }}
                />
                {item.count > 0 && (
                  <span className="absolute -top-5 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.count}
                  </span>
                )}
              </div>
              {index % Math.ceil(filledData.length / 7) === 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {dayLabel}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function fillMissingDates(
  data: PublishingTrendItem[],
  days: number
): PublishingTrendItem[] {
  const result: PublishingTrendItem[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0] ?? date.toISOString();

    const existing = data.find((d) => d.date === dateStr);
    result.push({
      date: dateStr,
      count: existing?.count ?? 0,
    });
  }

  return result;
}
