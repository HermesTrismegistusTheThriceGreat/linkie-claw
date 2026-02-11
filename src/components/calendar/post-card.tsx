"use client";

import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Post } from "@/types/post";

interface PostCardProps {
  post: Post;
  onHover?: (postId: string | null) => void;
  className?: string;
}

export function PostCard({ post, onHover, className }: PostCardProps) {
  const isScheduled = post.status === "scheduled";
  const showTime = isScheduled && post.scheduledAt;

  return (
    <div
      data-testid={`calendar-post-${post.id}`}
      className={cn(
        "rounded-lg p-2 cursor-pointer transition-transform",
        isScheduled
          ? "bg-primary/10 border border-primary/30 hover:scale-105"
          : "bg-black/5 opacity-60",
        className
      )}
      onMouseEnter={() => onHover?.(post.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      {showTime && post.scheduledAt && (
        <div className="flex items-center gap-1 mb-1">
          <span className="material-symbols-outlined text-[10px]">schedule</span>
          <span className="text-[8px] font-bold">
            {format(post.scheduledAt, "h:mm a")}
          </span>
        </div>
      )}
      <p className="text-[10px] truncate leading-tight">{post.title}</p>
    </div>
  );
}
