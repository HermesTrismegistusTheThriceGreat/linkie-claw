"use client";

import { useEffect, useState } from "react";

interface Summary {
  totalPosts: number;
  published: number;
  successRate: number;
  aiGenerations: number;
}

interface PostByStatus {
  date: string;
  status: string;
  count: number;
}

interface PublishingTrendItem {
  date: string;
  count: number;
}

interface TopPost {
  id: string;
  title: string;
  content: string;
  published_at: Date | null;
  linkedin_post_urn: string | null;
}

interface SchedulingPattern {
  day: string;
  count: number;
}

interface AnalyticsData {
  summary: Summary;
  postsByStatus: PostByStatus[];
  publishingTrend: PublishingTrendItem[];
  topPosts: TopPost[];
  schedulingPatterns: SchedulingPattern[];
}

export function useAnalyticsData(range: string) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/analytics?range=${range}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch analytics data");
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [range]);

  return { data, isLoading, error };
}
