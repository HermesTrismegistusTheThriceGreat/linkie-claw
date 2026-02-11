"use client";

import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Post, PostStatus } from "@/types/post";

interface PostCardProps {
  post: Post;
  onHover?: (postId: string | null) => void;
  onClick?: (post: Post) => void;
  className?: string;
}

const statusColors: Record<PostStatus, string> = {
  draft: "bg-gray-400",
  scheduled: "bg-blue-500",
  publishing: "bg-yellow-500",
  published: "bg-green-500",
  failed: "bg-red-500",
};

export function PostCard({ post, onHover, onClick, className }: PostCardProps) {
  const isScheduled = post.status === "scheduled";
  const showTime = isScheduled && post.scheduledAt;

  return (
    <button
      data-testid={`calendar-post-${post.id}`}
      onClick={() => onClick?.(post)}
      onMouseEnter={() => onHover?.(post.id)}
      onMouseLeave={() => onHover?.(null)}
      className={cn(
        "w-full text-left p-1.5 rounded-lg transition-colors",
        isScheduled
          ? "bg-primary/10 border border-primary/30 hover:bg-primary/20"
          : "bg-black/5 hover:bg-black/10",
        className
      )}
    >
      <p className="text-[10px] font-bold truncate leading-tight">
        {post.title}
      </p>
      <div className="flex items-center gap-1 mt-0.5">
        <span className={cn("size-1.5 rounded-full", statusColors[post.status])} />
        {showTime && post.scheduledAt && (
          <span className="text-[8px] opacity-60">
            {format(post.scheduledAt, "h:mm a")}
          </span>
        )}
      </div>
    </button>
  );
}
