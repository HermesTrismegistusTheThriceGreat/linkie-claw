"use client";

import Link from "next/link";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface CalendarHeaderProps {
  currentMonth: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  className?: string;
}

export function CalendarHeader({
  currentMonth,
  onPreviousMonth,
  onNextMonth,
  className,
}: CalendarHeaderProps) {
  return (
    <header
      className={cn(
        "h-20 flex items-center justify-between px-10",
        "glass-card border-b border-opacity-10 z-10",
        className
      )}
    >
      {/* Left Side: Month Navigation */}
      <div className="flex items-center gap-4">
        <button
          onClick={onPreviousMonth}
          data-testid="calendar-btn-prev-month"
          className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          aria-label="Previous month"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>

        <h1 className="text-2xl font-bold" data-testid="calendar-month-label">
          {format(currentMonth, "MMMM yyyy")}
        </h1>

        <button
          onClick={onNextMonth}
          data-testid="calendar-btn-next-month"
          className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          aria-label="Next month"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>

      {/* Right Side: Search + Create Button */}
      <div className="flex items-center gap-4">
        {/* Search Input */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            search
          </span>
          <input
            type="text"
            placeholder="Search posts..."
            data-testid="calendar-search-input"
            className={cn(
              "pl-10 pr-4 py-2",
              "bg-background dark:bg-background-dark/50",
              "border-none rounded-xl text-sm",
              "focus:ring-2 focus:ring-primary/50 focus:outline-none",
              "w-64"
            )}
          />
        </div>

        {/* Create Post Button - Coral Gradient */}
        <Link href="/create" data-testid="calendar-btn-create-post">
          <button
            className={cn(
              "coral-gradient",
              "text-white px-6 py-2.5 rounded-xl",
              "font-bold text-sm",
              "flex items-center gap-2",
              "transition-all hover:opacity-90 hover:shadow-lg"
            )}
          >
            <span className="material-symbols-outlined text-base">add</span>
            Create Post
          </button>
        </Link>
      </div>
    </header>
  );
}
