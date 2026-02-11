"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Post } from "@/types/post";
import { PostCard } from "./post-card";
import { PostTooltip } from "./post-tooltip";

interface CalendarDayProps {
  day: number;
  dayKey: string;
  isCurrentMonth: boolean;
  isToday?: boolean;
  posts?: Post[];
  onPostHover?: (postId: string | null) => void;
  onPostClick?: (post: Post) => void;
  onShowMore?: (day: number, posts: Post[]) => void;
  className?: string;
}

const MAX_VISIBLE_POSTS = 2;

export function CalendarDay({
  day,
  dayKey,
  isCurrentMonth,
  isToday = false,
  posts = [],
  onPostHover,
  onPostClick,
  onShowMore,
  className,
}: CalendarDayProps) {
  const [hoveredPostId, setHoveredPostId] = useState<string | null>(null);

  const handlePostHover = (postId: string | null) => {
    setHoveredPostId(postId);
    onPostHover?.(postId);
  };

  const hoveredPost = posts.find((p) => p.id === hoveredPostId);

  const visiblePosts = posts.slice(0, MAX_VISIBLE_POSTS);
  const hiddenCount = posts.length - MAX_VISIBLE_POSTS;

  return (
    <div
      className={cn(
        "h-32 p-3 border-r border-b border-black/5 relative overflow-hidden",
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
        <div className="mt-2 flex flex-col gap-1">
          {visiblePosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onHover={handlePostHover}
              onClick={onPostClick}
            />
          ))}
          {hiddenCount > 0 && (
            <button
              data-testid={`calendar-day-${dayKey}-more`}
              className="text-xs text-primary font-bold hover:underline text-left px-1"
              onClick={() => onShowMore?.(day, posts)}
            >
              +{hiddenCount} more
            </button>
          )}
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
