interface ScheduleBarProps {
  date: Date;
  time: string;
  timezone: string;
}

export function ScheduleBar({ date, time, timezone }: ScheduleBarProps) {
  const formattedDate = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex justify-center pt-4">
      <div className="bg-white border border-gray-100 rounded-full px-6 py-3 flex items-center gap-6 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-2 text-[#333333]/70">
          <span className="material-symbols-outlined text-[#ee5b2b] text-xl">
            calendar_today
          </span>
          <span className="text-sm font-medium">{formattedDate}</span>
        </div>
        <div className="w-px h-6 bg-gray-100" />
        <div className="flex items-center gap-2 text-[#333333]/70">
          <span className="material-symbols-outlined text-[#ee5b2b] text-xl">
            schedule
          </span>
          <span className="text-sm font-medium">{time}</span>
        </div>
        <div className="w-px h-6 bg-gray-100" />
        <div className="flex items-center gap-2 text-[#333333]/70">
          <span className="material-symbols-outlined text-[#ee5b2b] text-xl">
            public
          </span>
          <span className="text-sm font-medium">{timezone}</span>
        </div>
      </div>
    </div>
  );
}
