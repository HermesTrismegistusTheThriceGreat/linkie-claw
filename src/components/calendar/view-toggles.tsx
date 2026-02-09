// src/components/calendar/view-toggles.tsx

interface ViewTogglesProps {
  activeView?: "monthly" | "weekly" | "list";
  postCount: number;
}

export function ViewToggles({
  activeView = "monthly",
  postCount,
}: ViewTogglesProps) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div className="flex gap-2">
        <button
          className={
            activeView === "monthly"
              ? "rounded-full border border-black/5 bg-white px-4 py-1.5 text-xs font-semibold"
              : "rounded-full px-4 py-1.5 text-xs font-semibold opacity-50"
          }
          disabled={activeView !== "monthly"}
        >
          Monthly
        </button>
        <button
          className={
            activeView === "weekly"
              ? "rounded-full border border-black/5 bg-white px-4 py-1.5 text-xs font-semibold"
              : "rounded-full px-4 py-1.5 text-xs font-semibold opacity-50"
          }
          disabled={activeView !== "weekly"}
        >
          Weekly
        </button>
        <button
          className={
            activeView === "list"
              ? "rounded-full border border-black/5 bg-white px-4 py-1.5 text-xs font-semibold"
              : "rounded-full px-4 py-1.5 text-xs font-semibold opacity-50"
          }
          disabled={activeView !== "list"}
        >
          List View
        </button>
      </div>
      <div className="text-sm font-medium opacity-60">
        {postCount} {postCount === 1 ? "post" : "posts"} scheduled this month
      </div>
    </div>
  );
}
