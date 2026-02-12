interface SummaryData {
  totalPosts: number;
  published: number;
  successRate: number;
  aiGenerations: number;
}

interface SummaryCardsProps {
  data: SummaryData;
}

export function SummaryCards({ data }: SummaryCardsProps) {
  const cards = [
    {
      label: "Total Posts",
      value: data.totalPosts,
      icon: "post",
      color: "primary",
    },
    {
      label: "Published",
      value: data.published,
      icon: "check_circle",
      color: "green",
    },
    {
      label: "Success Rate",
      value: `${data.successRate}%`,
      icon: "trending_up",
      color: "blue",
    },
    {
      label: "AI Generations",
      value: data.aiGenerations,
      icon: "auto_fix",
      color: "purple",
    },
  ];

  return (
    <div
      data-testid="analytics-summary-cards"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
    >
      {cards.map((card) => (
        <div
          key={card.label}
          data-testid={`analytics-summary-${card.label.toLowerCase().replace(/\s+/g, "-")}`}
          className="glass-card rounded-2xl p-6 border border-white/50"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                {card.label}
              </p>
              <p className="text-3xl font-extrabold">{card.value}</p>
            </div>
            <div
              className={`size-12 rounded-xl flex items-center justify-center bg-${card.color}/10`}
            >
              <span
                className={`material-symbols-outlined text-2xl text-${card.color}`}
              >
                {card.icon}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
