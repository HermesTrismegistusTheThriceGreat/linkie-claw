"use client";

import { useState, useEffect } from "react";
import { subMonths, addMonths, format } from "date-fns";
import { Sidebar } from "@/components/layout/sidebar";
import { CalendarHeader } from "@/components/calendar/header";
import { ViewToggles } from "@/components/calendar/view-toggles";
import { CalendarGrid } from "@/components/calendar/calendar-grid";
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

  // Fetch posts for current month via API
  useEffect(() => {
    async function fetchPosts() {
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
        setPosts([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPosts();
  }, [currentMonth]);

  const handlePreviousMonth = () => {
    setCurrentMonth((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => addMonths(prev, 1));
  };

  return (
    <div className="aurora-bg min-h-screen flex">
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
            <div className="glass-card rounded-2xl shadow-2xl p-12 flex items-center justify-center">
              <p className="text-gray-500">Loading calendar...</p>
            </div>
          ) : (
            <CalendarGrid currentMonth={currentMonth} posts={posts} />
          )}
        </div>
      </main>

      <Fab />
    </div>
  );
}
