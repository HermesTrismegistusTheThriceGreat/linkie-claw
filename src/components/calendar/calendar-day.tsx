"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Post } from "@/types/post";
import { PostCard } from "./post-card";
import { PostTooltip } from "./post-tooltip";

interface CalendarDayProps {
  day: number;
  isCurrentMonth: boolean;
  isToday?: boolean;
  posts?: Post[];
  onPostHover?: (postId: string | null) => void;
  className?: string;
}

export function CalendarDay({
  day,
  isCurrentMonth,
  isToday = false,
  posts = [],
  onPostHover,
  className,
}: CalendarDayProps) {
  const [hoveredPostId, setHoveredPostId] = useState<string | null>(null);

  const handlePostHover = (postId: string | null) => {
    setHoveredPostId(postId);
    onPostHover?.(postId);
  };

  const hoveredPost = posts.find((p) => p.id === hoveredPostId);

  return (
    <div
      className={cn(
        "h-32 p-3 border-r border-b border-black/5 relative",
        // Previous/next month styling
        !isCurrentMonth && "opacity-30",
        // Current month styling
        isCurrentMonth && "bg-white/40 font-bold",
        // Today styling
        isToday && "bg-primary/5",
        className
      )}
    >
      {/* Day number */}
      {isToday ? (
        <span className="inline-block size-6 bg-primary text-white text-[10px] rounded-full text-center leading-6 mb-2">
          {day}
        </span>
      ) : (
        <span className={cn(isCurrentMonth && "font-bold")}>{day}</span>
      )}

      {/* Post cards */}
      {posts.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onHover={handlePostHover}
            />
          ))}
        </div>
      )}

      {/* Tooltip for hovered post */}
      {hoveredPost && (
        <PostTooltip
          post={hoveredPost}
          visible={true}
        />
      )}
    </div>
  );
}
