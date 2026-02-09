interface StatCardProps {
  label: string;
  value: string;
  changeLabel: string;
  icon: string;
  color: "orange" | "purple" | "blue";
}

const colorClasses = {
  orange: {
    bg: "bg-orange-100",
    text: "text-orange-600",
  },
  purple: {
    bg: "bg-purple-100",
    text: "text-purple-600",
  },
  blue: {
    bg: "bg-blue-100",
    text: "text-blue-600",
  },
} as const;

export function StatCard({
  label,
  value,
  changeLabel,
  icon,
  color,
}: StatCardProps) {
  const colors = colorClasses[color];

  return (
    <div className="glass-card p-6 rounded-2xl border border-white/40 shadow-sm group hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 ${colors.bg} rounded-lg`}>
          <span className={`material-symbols-outlined ${colors.text}`}>
            {icon}
          </span>
        </div>
        <span className="text-green-600 font-bold text-sm flex items-center bg-green-50 px-2 py-0.5 rounded-full">
          {changeLabel}
        </span>
      </div>
      <p className="text-slate-500 text-sm font-semibold uppercase tracking-wider">
        {label}
      </p>
      <p className="text-3xl font-black mt-1">{value}</p>
    </div>
  );
}
