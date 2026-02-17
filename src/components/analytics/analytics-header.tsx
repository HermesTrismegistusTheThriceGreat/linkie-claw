type TimeRange = "7d" | "30d" | "90d" | "365d";

interface AnalyticsHeaderProps {
  currentRange: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  ranges: readonly TimeRange[];
}

export function AnalyticsHeader({
  currentRange,
  onRangeChange,
  ranges,
}: AnalyticsHeaderProps) {
  const rangeLabels: Record<string, string> = {
    "7d": "Last 7 Days",
    "30d": "Last 30 Days",
    "90d": "Last 90 Days",
    "365d": "Last Year",
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1
          data-testid="analytics-title"
          className="text-3xl font-extrabold tracking-tight mb-1"
        >
          Analytics
        </h1>
        <p className="text-muted-foreground">
          Track your content performance and posting patterns
        </p>
      </div>

      <div
        data-testid="analytics-range-selector"
        className="flex items-center gap-2 bg-white/50 backdrop-blur-sm rounded-xl p-1 border border-white/50"
      >
        {ranges.map((range) => (
          <button
            key={range}
            data-testid={`analytics-range-${range}`}
            onClick={() => onRangeChange(range)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              currentRange === range
                ? "bg-primary text-white shadow-md"
                : "hover:bg-white/50 text-muted-foreground"
            }`}
          >
            {rangeLabels[range]}
          </button>
        ))}
      </div>
    </div>
  );
}
