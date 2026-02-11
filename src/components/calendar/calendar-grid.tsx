"use client";

import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday, format } from "date-fns";
import { CalendarDay } from "./calendar-day";
import type { Post } from "@/types/post";

interface CalendarGridProps {
  currentMonth: Date;
  posts: Post[];
  className?: string;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarGrid({ currentMonth, posts, className }: CalendarGridProps) {
  // Calculate calendar days to display (including previous/next month padding)
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Group posts by day
  const postsByDay = new Map<string, Post[]>();
  posts.forEach((post) => {
    if (post.scheduledAt) {
      const dayKey = format(post.scheduledAt, "yyyy-MM-dd");
      const existing = postsByDay.get(dayKey) || [];
      postsByDay.set(dayKey, [...existing, post]);
    }
  });

  return (
    <div
      data-testid="calendar-grid"
      className={`grid grid-cols-7 gap-px glass-card rounded-2xl overflow-hidden border-opacity-20 shadow-2xl relative ${className || ""}`}
    >
      {/* Weekday headers */}
      {WEEKDAY_LABELS.map((day) => (
        <div
          key={day}
          data-testid={`calendar-weekday-${day.toLowerCase()}`}
          className="bg-black/5 dark:bg-white/5 py-4 text-center text-xs font-bold uppercase tracking-widest opacity-60 border-b border-black/5 dark:border-white/10"
        >
          {day}
        </div>
      ))}

      {/* Calendar days grid */}
      {calendarDays.map((day) => {
        const dayKey = format(day, "yyyy-MM-dd");
        const dayPosts = postsByDay.get(dayKey) || [];
        const isCurrentMonth = isSameMonth(day, currentMonth);
        const isTodayDate = isToday(day);

        return (
          <CalendarDay
            key={dayKey}
            data-testid={`calendar-day-${dayKey}`}
            day={day.getDate()}
            isCurrentMonth={isCurrentMonth}
            isToday={isTodayDate}
            posts={dayPosts}
          />
        );
      })}
    </div>
  );
}
