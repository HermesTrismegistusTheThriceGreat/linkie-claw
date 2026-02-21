"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { Post, PostStatus } from "@/types/post";

interface PostEditModalProps {
  post: Post | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: Partial<Post>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const statusLabels: Record<PostStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  publishing: "Publishing",
  published: "Published",
  failed: "Failed",
};

const statusVariants: Record<PostStatus, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  scheduled: "secondary",
  publishing: "default",
  published: "default",
  failed: "destructive",
};

export function PostEditModal({
  post,
  open,
  onOpenChange,
  onSave,
  onDelete,
}: PostEditModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>(undefined);
  const [imageUrl, setImageUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset state when post changes
  useEffect(() => {
    if (post) {
      setTitle(post.title);
      setContent(post.content);
      setScheduledAt(post.scheduledAt);
      setImageUrl(post.imageUrl || "");
      console.log("[DEBUG] Modal opened — post.scheduledAt:", post.scheduledAt);
      console.log("[DEBUG] Modal opened — post.scheduledAt ISO:", post.scheduledAt instanceof Date ? post.scheduledAt.toISOString() : post.scheduledAt);
      console.log("[DEBUG] Modal opened — browser timezone:", Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
  }, [post]);

  const handleSave = async () => {
    if (!post) return;
    setIsSaving(true);
    const payload = {
      title,
      content,
      scheduledAt,
      imageUrl: imageUrl || null,
    };
    console.log("[DEBUG] handleSave called. imageUrl state:", JSON.stringify(imageUrl));
    console.log("[DEBUG] handleSave — scheduledAt Date:", scheduledAt?.toString());
    console.log("[DEBUG] handleSave — scheduledAt ISO:", scheduledAt?.toISOString());
    console.log("[DEBUG] handleSave payload:", JSON.stringify(payload, null, 2));
    try {
      await onSave(post.id, payload);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!post || !confirm("Are you sure you want to delete this post?")) return;
    setIsDeleting(true);
    try {
      await onDelete(post.id);
      onOpenChange(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRemoveImage = () => {
    console.log("[DEBUG] Remove Image clicked. imageUrl before:", imageUrl);
    setImageUrl("");
    console.log("[DEBUG] setImageUrl called with empty string");
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateStr = e.target.value;
    if (!dateStr) {
      setScheduledAt(undefined);
      return;
    }
    const time = scheduledAt ? format(scheduledAt, "HH:mm") : "09:00";
    const dateTimeStr = `${dateStr}T${time}`;
    const newDate = new Date(dateTimeStr);
    console.log("[DEBUG] handleDateChange — input dateStr:", dateStr);
    console.log("[DEBUG] handleDateChange — existing time (from format):", time);
    console.log("[DEBUG] handleDateChange — combined string:", dateTimeStr);
    console.log("[DEBUG] handleDateChange — new Date result:", newDate.toString());
    console.log("[DEBUG] handleDateChange — new Date ISO:", newDate.toISOString());
    setScheduledAt(newDate);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const timeStr = e.target.value;
    if (!scheduledAt) return;
    const dateStr = format(scheduledAt, "yyyy-MM-dd");
    const dateTimeStr = `${dateStr}T${timeStr}`;
    const newDate = new Date(dateTimeStr);
    console.log("[DEBUG] handleTimeChange — input timeStr:", timeStr);
    console.log("[DEBUG] handleTimeChange — existing scheduledAt ISO:", scheduledAt.toISOString());
    console.log("[DEBUG] handleTimeChange — date from format():", dateStr);
    console.log("[DEBUG] handleTimeChange — combined string:", dateTimeStr);
    console.log("[DEBUG] handleTimeChange — new Date result:", newDate.toString());
    console.log("[DEBUG] handleTimeChange — new Date ISO:", newDate.toISOString());
    setScheduledAt(newDate);
  };

  if (!post) return null;

  const linkedInLimit = 3000;
  const charCount = content.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="post-edit-modal"
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle data-testid="post-edit-title-header">Edit Post</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm opacity-60">Status:</span>
            <Badge variant={statusVariants[post.status]} data-testid="post-edit-status">
              {statusLabels[post.status]}
            </Badge>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="post-title" className="text-sm font-bold block mb-2">
              Title
            </label>
            <Input
              id="post-title"
              data-testid="post-edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Post title..."
            />
          </div>

          {/* Content */}
          <div>
            <label htmlFor="post-content" className="text-sm font-bold block mb-2">
              Content
            </label>
            <Textarea
              id="post-content"
              data-testid="post-edit-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder="Write your post content..."
            />
            <p
              className={`text-xs text-right mt-1 ${
                charCount > linkedInLimit ? "text-red-500" : "opacity-60"
              }`}
              data-testid="post-edit-char-count"
            >
              {charCount} / {linkedInLimit} characters
            </p>
          </div>

          {/* Image */}
          <div>
            <label className="text-sm font-bold block mb-2">Image</label>
            {imageUrl ? (
              <div className="space-y-3">
                <img
                  src={imageUrl}
                  alt="Post image"
                  className="rounded-xl max-h-48 object-cover w-full"
                  data-testid="post-edit-image"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveImage}
                  data-testid="post-edit-remove-image"
                >
                  Remove Image
                </Button>
              </div>
            ) : (
              <div
                className="rounded-xl border-2 border-dashed border-gray-300 p-8 text-center opacity-60"
                data-testid="post-edit-no-image"
              >
                <p className="text-sm">No image attached</p>
              </div>
            )}
          </div>

          {/* Schedule */}
          <div>
            <label className="text-sm font-bold block mb-2">Schedule</label>
            <div className="flex gap-4">
              <div className="flex-1">
                <label htmlFor="post-date" className="text-xs opacity-60 block mb-1">
                  Date
                </label>
                <Input
                  id="post-date"
                  data-testid="post-edit-date"
                  type="date"
                  value={scheduledAt ? format(scheduledAt, "yyyy-MM-dd") : ""}
                  onChange={handleDateChange}
                />
              </div>
              <div className="flex-1">
                <label htmlFor="post-time" className="text-xs opacity-60 block mb-1">
                  Time
                </label>
                <Input
                  id="post-time"
                  data-testid="post-edit-time"
                  type="time"
                  value={scheduledAt ? format(scheduledAt, "HH:mm") : ""}
                  onChange={handleTimeChange}
                  disabled={!scheduledAt}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center pt-4 border-t">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              data-testid="post-edit-delete"
            >
              {isDeleting ? "Deleting..." : "Delete Post"}
            </Button>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="post-edit-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                data-testid="post-edit-save"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
