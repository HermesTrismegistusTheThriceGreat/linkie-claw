"use client";

import { useState, useEffect, useCallback } from "react";
import { subMonths, addMonths, format } from "date-fns";
import { toast } from "sonner";
import { Sidebar } from "@/components/layout/sidebar";
import { CalendarHeader } from "@/components/calendar/header";
import { ViewToggles } from "@/components/calendar/view-toggles";
import { CalendarGrid } from "@/components/calendar/calendar-grid";
import { PostEditModal } from "@/components/calendar/post-edit-modal";
import { Fab } from "@/components/calendar/fab";
import type { Post } from "@/types/post";

interface ApiPost {
  id: string;
  userId: string;
  title: string;
  content: string;
  imageUrl?: string;
  scheduledAt?: string;
  publishedAt?: string;
  status: Post["status"];
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

function parseApiPost(apiPost: ApiPost): Post {
  return {
    ...apiPost,
    scheduledAt: apiPost.scheduledAt ? new Date(apiPost.scheduledAt) : undefined,
    publishedAt: apiPost.publishedAt ? new Date(apiPost.publishedAt) : undefined,
    createdAt: new Date(apiPost.createdAt),
    updatedAt: new Date(apiPost.updatedAt),
  };
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal state
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Fetch posts for current month via API
  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const monthKey = format(currentMonth, "yyyy-MM");
      const response = await fetch(`/api/posts?month=${monthKey}`);
      if (!response.ok) {
        throw new Error("Failed to fetch posts");
      }
      const apiPosts: ApiPost[] = await response.json();
      setPosts(apiPosts.map(parseApiPost));
    } catch (error) {
      console.error("Failed to fetch posts:", error);
      toast.error("Failed to load posts");
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handlePreviousMonth = () => {
    setCurrentMonth((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => addMonths(prev, 1));
  };

  const handlePostClick = (post: Post) => {
    setEditingPost(post);
    setIsEditModalOpen(true);
  };

  const handleSave = async (id: string, data: Partial<Post>) => {
    const requestBody = {
      ...data,
      scheduledAt: data.scheduledAt?.toISOString(),
    };
    console.log("[DEBUG] Calendar handleSave — data received:", JSON.stringify(data, null, 2));
    console.log("[DEBUG] Calendar handleSave — request body:", JSON.stringify(requestBody, null, 2));
    console.log("[DEBUG] Calendar handleSave — imageUrl in body:", JSON.stringify(requestBody.imageUrl));

    const response = await fetch(`/api/posts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const responseBody = await response.json();
    console.log("[DEBUG] Calendar handleSave — response status:", response.status);
    console.log("[DEBUG] Calendar handleSave — response body:", JSON.stringify(responseBody, null, 2));

    if (response.ok) {
      await fetchPosts();
      toast.success("Post updated successfully!");
    } else {
      toast.error(responseBody.message || "Failed to update post");
      throw new Error(responseBody.message || "Failed to update post");
    }
  };

  const handleDelete = async (id: string) => {
    const response = await fetch(`/api/posts/${id}`, { method: "DELETE" });
    
    if (response.ok) {
      await fetchPosts();
      toast.success("Post deleted");
    } else {
      const error = await response.json();
      toast.error(error.message || "Failed to delete post");
      throw new Error(error.message || "Failed to delete post");
    }
  };

  return (
    <div className="aurora-bg min-h-screen flex" data-testid="page-calendar">
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-y-auto">
        <CalendarHeader
          currentMonth={currentMonth}
          onPreviousMonth={handlePreviousMonth}
          onNextMonth={handleNextMonth}
        />

        <div className="p-8 flex-1">
          <ViewToggles activeView="monthly" postCount={posts.length} />

          {isLoading ? (
            <div aria-busy="true" aria-live="polite" data-testid="calendar-loading" className="glass-card rounded-2xl shadow-2xl p-12 flex items-center justify-center">
              <p className="text-gray-500">Loading calendar...</p>
            </div>
          ) : (
            <CalendarGrid 
              currentMonth={currentMonth} 
              posts={posts} 
              onPostClick={handlePostClick}
            />
          )}
        </div>
      </main>

      <Fab />

      <PostEditModal
        post={editingPost}
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
