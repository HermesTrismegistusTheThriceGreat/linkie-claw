import { cn } from "@/lib/utils";

interface PlannerDayProps {
  date: Date;
  dayName: string;
  dayNumber: number;
  post?: {
    title: string;
    time: string;
  };
  color: "orange" | "purple" | "blue" | "slate";
}

const colorMap = {
  orange: {
    badgeBg: "bg-orange-100",
    badgeBorder: "border-orange-200",
    dayNameText: "text-orange-600",
    dayNumberText: "text-orange-700",
  },
  purple: {
    badgeBg: "bg-purple-100",
    badgeBorder: "border-purple-200",
    dayNameText: "text-purple-600",
    dayNumberText: "text-purple-700",
  },
  blue: {
    badgeBg: "bg-blue-100",
    badgeBorder: "border-blue-200",
    dayNameText: "text-blue-600",
    dayNumberText: "text-blue-700",
  },
  slate: {
    badgeBg: "bg-slate-100",
    badgeBorder: "",
    dayNameText: "text-slate-500",
    dayNumberText: "text-slate-600",
  },
};

export function PlannerDay({
  dayName,
  dayNumber,
  post,
  color,
}: PlannerDayProps) {
  const colors = colorMap[color];

  if (post) {
    return (
      <div className="p-4 flex gap-4 items-center">
        <div
          className={cn(
            "size-12 rounded-xl flex flex-col items-center justify-center shrink-0",
            colors.badgeBg,
            colors.badgeBorder && `border ${colors.badgeBorder}`
          )}
        >
          <span
            className={cn(
              "text-[10px] font-bold uppercase",
              colors.dayNameText
            )}
          >
            {dayName}
          </span>
          <span
            className={cn(
              "text-lg font-black leading-none",
              colors.dayNumberText
            )}
          >
            {dayNumber}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm truncate">{post.title}</p>
          <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">
              schedule
            </span>{" "}
            {post.time}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 flex gap-4 items-center bg-white/40">
      <div
        className={cn(
          "size-12 rounded-xl flex flex-col items-center justify-center shrink-0",
          colors.badgeBg
        )}
      >
        <span
          className={cn("text-[10px] font-bold uppercase", colors.dayNameText)}
        >
          {dayName}
        </span>
        <span
          className={cn("text-lg font-black leading-none", colors.dayNumberText)}
        >
          {dayNumber}
        </span>
      </div>
      <div className="min-w-0">
        <p className="font-bold text-sm truncate italic text-slate-400">
          No posts scheduled
        </p>
        <button className="text-primary text-[10px] font-bold uppercase tracking-tight">
          + Add Post
        </button>
      </div>
    </div>
  );
}
