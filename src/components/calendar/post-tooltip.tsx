"use client";

import { format } from "date-fns";
import type { Post } from "@/types/post";
import { cn } from "@/lib/utils";

interface PostTooltipProps {
  post: Post;
  visible: boolean;
  className?: string;
}

const STATUS_STYLES = {
  scheduled: "bg-green-500/20 text-green-600",
  draft: "bg-yellow-500/20 text-yellow-600",
  publishing: "bg-amber-500/20 text-amber-600",
  published: "bg-blue-500/20 text-blue-600",
  failed: "bg-red-500/20 text-red-600",
} as const;

const ENGAGEMENT_FORECAST = {
  scheduled: "High",
  draft: "N/A",
  publishing: "Processing",
  published: "Actual",
  failed: "N/A",
} as const;

function extractHashtags(content: string): string[] {
  const matches = content.match(/#\w+/g);
  return matches ? matches.slice(0, 5) : [];
}

function truncateContent(content: string, maxLength: number = 150): string {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength).trim() + "...";
}

export function PostTooltip({ post, visible, className }: PostTooltipProps) {
  const hashtags = extractHashtags(post.content);
  const displayDate = post.scheduledAt || post.createdAt;
  const formattedDate = format(displayDate, "MMM d");
  const formattedTime = format(displayDate, "h:mm a");

  return (
    <div
      className={cn(
        "absolute top-0 left-full ml-4 w-72 glass-tooltip rounded-2xl p-5 z-50 pointer-events-none transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0",
        className
      )}
    >
      {/* Header: Status Badge + Action Icons */}
      <div className="flex items-center justify-between mb-4">
        <span
          className={cn(
            "px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider",
            STATUS_STYLES[post.status]
          )}
        >
          {post.status}
        </span>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-sm opacity-60">
            edit
          </span>
          <span className="material-symbols-outlined text-sm opacity-60">
            delete
          </span>
        </div>
      </div>

      {/* Image Preview */}
      {post.imageUrl && (
        <div
          className="aspect-video w-full rounded-xl bg-cover bg-center mb-4"
          style={{ backgroundImage: `url('${post.imageUrl}')` }}
        />
      )}

      {/* Title */}
      <h3 className="text-sm font-extrabold mb-2 leading-tight">
        {post.title}
      </h3>

      {/* Content Excerpt */}
      <p className="text-xs opacity-70 mb-4 line-clamp-3">
        {truncateContent(post.content)}
      </p>

      {/* Hashtags */}
      {hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {hashtags.map((tag, index) => (
            <span
              key={index}
              className="px-2 py-0.5 bg-black/5 rounded text-[10px] font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer: Date/Time + Engagement Forecast */}
      <div className="pt-4 border-t border-black/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#ee5b2b] text-lg">
            event
          </span>
          <span className="text-xs font-bold">
            {formattedDate} • {formattedTime}
          </span>
        </div>
        <div className="flex items-center gap-1 opacity-60">
          <span className="material-symbols-outlined text-sm">bar_chart</span>
          <span className="text-[10px]">
            Forecast: {ENGAGEMENT_FORECAST[post.status]}
          </span>
        </div>
      </div>
    </div>
  );
}
