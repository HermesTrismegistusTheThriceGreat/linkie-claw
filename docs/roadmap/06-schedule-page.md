# Phase 6: Schedule Page — Calendar Polish & Post Editing

## Goal
Fix post rendering on the calendar so each post displays cleanly with no overlap. Make posts clickable with an edit modal for text, date, images, and deletion.

## Done When
Posts render without overlap on the calendar, a user can click any post, edit it in a modal, save, and see the calendar update in real time.

## Depends On
Phase 3 (Multi-User Support) — user-scoped posts

---

## Step-by-Step Plan

### 6.1 — Fix Calendar Post Rendering (No Overlap)

#### 6.1.1 — Analyze current rendering issue

The current `CalendarDay` component (`src/components/calendar/calendar-day.tsx`) renders all posts in a vertical stack:
```tsx
<div className="mt-2 flex flex-col gap-1.5">
  {posts.map((post) => (
    <PostCard key={post.id} post={post} onHover={handlePostHover} />
  ))}
</div>
```

The day cell is fixed at `h-32` (128px). With multiple posts, the cards overflow the cell boundary.

#### 6.1.2 — Solution: Limit visible posts + overflow indicator

```tsx
const MAX_VISIBLE_POSTS = 2;
const visiblePosts = posts.slice(0, MAX_VISIBLE_POSTS);
const hiddenCount = posts.length - MAX_VISIBLE_POSTS;

<div className="mt-2 flex flex-col gap-1">
  {visiblePosts.map((post) => (
    <PostCard key={post.id} post={post} onClick={() => openEditModal(post)} />
  ))}
  {hiddenCount > 0 && (
    <button
      className="text-xs text-primary font-bold hover:underline"
      onClick={() => openDayModal(day, posts)}
      data-testid={`calendar-day-${dayKey}-more`}
    >
      +{hiddenCount} more
    </button>
  )}
</div>
```

#### 6.1.3 — Make PostCard more compact

Update `src/components/calendar/post-card.tsx` to be smaller:
- Reduce padding to `p-1.5`
- Truncate title to 1 line with ellipsis
- Use smaller text (`text-[10px]`)
- Add status color indicator (dot/stripe)
- Make the entire card clickable (remove hover-only tooltip)

```tsx
<button
  data-testid={`calendar-post-${post.id}`}
  onClick={() => onClick?.(post)}
  className="w-full text-left p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
>
  <p className="text-[10px] font-bold truncate">{post.title}</p>
  <div className="flex items-center gap-1 mt-0.5">
    <span className={`size-1.5 rounded-full ${statusColors[post.status]}`} />
    <span className="text-[8px] opacity-60">
      {format(post.scheduledAt, "h:mm a")}
    </span>
  </div>
</button>
```

#### 6.1.4 — Add overflow hidden to day cell
```tsx
<div className="h-32 p-3 border-r border-b overflow-hidden relative">
```

---

### 6.2 — Build Post Edit Modal

#### 6.2.1 — Create `src/components/calendar/post-edit-modal.tsx`

Modal structure:
```
Post Edit Modal
├── Header: "Edit Post" with close button
├── Section: Post Content
│   ├── Input: Title (text input)
│   ├── Textarea: Content (rich text area with character count)
│   └── Character count / LinkedIn limit indicator
├── Section: Image
│   ├── Current image preview (if exists)
│   ├── Button: Change Image (opens file picker / URL input)
│   └── Button: Remove Image
├── Section: Schedule
│   ├── Date picker
│   ├── Time picker
│   └── Status badge (draft/scheduled/published)
├── Footer: Actions
│   ├── Button (destructive): Delete Post
│   ├── Button (secondary): Cancel
│   └── Button (primary): Save Changes
```

#### 6.2.2 — Modal implementation

Use the existing Radix UI Dialog component (from `src/components/ui/`):

```tsx
"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Post } from "@/types/post";

interface PostEditModalProps {
  post: Post | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: Partial<Post>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function PostEditModal({ post, open, onOpenChange, onSave, onDelete }: PostEditModalProps) {
  const [title, setTitle] = useState(post?.title || "");
  const [content, setContent] = useState(post?.content || "");
  const [scheduledAt, setScheduledAt] = useState<Date | null>(post?.scheduledAt || null);
  const [imageUrl, setImageUrl] = useState(post?.imageUrl || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset state when post changes
  useEffect(() => {
    if (post) {
      setTitle(post.title);
      setContent(post.content);
      setScheduledAt(post.scheduledAt || null);
      setImageUrl(post.imageUrl || "");
    }
  }, [post]);

  const handleSave = async () => {
    if (!post) return;
    setIsSaving(true);
    try {
      await onSave(post.id, { title, content, scheduledAt, imageUrl });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!post || !confirm("Are you sure you want to delete this post?")) return;
    setIsDeleting(true);
    await onDelete(post.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="post-edit-modal" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Post</DialogTitle>
        </DialogHeader>

        {/* Title */}
        <div>
          <label htmlFor="post-title" className="text-sm font-bold">Title</label>
          <input
            id="post-title"
            data-testid="post-edit-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-3 rounded-xl border ..."
          />
        </div>

        {/* Content */}
        <div>
          <label htmlFor="post-content" className="text-sm font-bold">Content</label>
          <textarea
            id="post-content"
            data-testid="post-edit-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            className="w-full p-3 rounded-xl border ..."
          />
          <p className="text-xs text-right mt-1 opacity-60">
            {content.length} / 3000 characters
          </p>
        </div>

        {/* Image */}
        {imageUrl && <img src={imageUrl} alt="Post image" className="rounded-xl" />}

        {/* Schedule */}
        <div className="flex gap-4">
          <input type="date" data-testid="post-edit-date" ... />
          <input type="time" data-testid="post-edit-time" ... />
        </div>

        {/* Actions */}
        <div className="flex justify-between mt-4">
          <button data-testid="post-edit-delete" onClick={handleDelete} className="text-red-500 ...">
            Delete Post
          </button>
          <div className="flex gap-3">
            <button data-testid="post-edit-cancel" onClick={() => onOpenChange(false)}>Cancel</button>
            <button data-testid="post-edit-save" onClick={handleSave} className="bg-primary ...">
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

### 6.3 — Wire Modal to Calendar Page

#### 6.3.1 — Update `src/app/calendar/page.tsx`

Add modal state and API handlers:

```tsx
const [editingPost, setEditingPost] = useState<Post | null>(null);
const [isEditModalOpen, setIsEditModalOpen] = useState(false);

const handlePostClick = (post: Post) => {
  setEditingPost(post);
  setIsEditModalOpen(true);
};

const handleSave = async (id: string, data: Partial<Post>) => {
  const response = await fetch(`/api/posts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (response.ok) {
    // Re-fetch posts to update calendar
    await fetchPosts();
    toast.success("Post updated!");
  }
};

const handleDelete = async (id: string) => {
  const response = await fetch(`/api/posts/${id}`, { method: "DELETE" });
  if (response.ok) {
    await fetchPosts();
    toast.success("Post deleted");
  }
};
```

#### 6.3.2 — Pass click handler through component tree
```
CalendarPage → CalendarGrid → CalendarDay → PostCard
```

Add `onPostClick` prop through the component chain.

---

### 6.4 — Handle Reschedule via Drag (Optional Enhancement)

If time permits, add drag-to-reschedule:
1. Make PostCard draggable (`draggable="true"`)
2. Make CalendarDay a drop target
3. On drop, call `PATCH /api/posts/{id}` with new `scheduledAt`
4. Re-fetch calendar posts to reflect change

> This is an enhancement — not required for the "done when" criteria. Mark as optional in implementation.

---

### 6.5 — Immediate Calendar Re-render

After saving or deleting via the modal, the calendar must update immediately without a full page reload:

```tsx
// After successful save/delete:
const fetchPosts = async () => {
  const monthKey = format(currentMonth, "yyyy-MM");
  const response = await fetch(`/api/posts?month=${monthKey}`);
  const apiPosts = await response.json();
  setPosts(apiPosts.map(parseApiPost));
};
```

The calendar already uses `useState` for posts, so updating the state will trigger a re-render.

---

## Verification Checklist

- [ ] Posts render within day cell boundaries (no overflow)
- [ ] Days with >2 posts show "+N more" indicator
- [ ] Clicking a post opens the edit modal
- [ ] Modal shows current title, content, image, and scheduled date
- [ ] User can edit the title and save — change persists
- [ ] User can edit the content and save — change persists
- [ ] User can change the scheduled date/time and save
- [ ] User can delete a post from the modal
- [ ] After saving, the calendar re-renders immediately with updated data
- [ ] After deleting, the post disappears from the calendar immediately
- [ ] Character count updates as user types
- [ ] All modal elements have `data-testid` attributes
- [ ] Modal has proper ARIA attributes (`role="dialog"`, `aria-modal`)
- [ ] `npm run typecheck` passes with no errors
