import { getUpcomingPosts } from "@/lib/queries/posts";
import { PlannerDay } from "./planner-day";
import { format } from "date-fns";

const colorRotation = ["orange", "slate", "purple", "blue"] as const;

interface PlannerWidgetProps {
  userId: string;
}

export async function PlannerWidget({ userId }: PlannerWidgetProps) {
  const posts = await getUpcomingPosts(userId, 4);
  const today = new Date();

  // Generate next 4 days starting from today
  const days = Array.from({ length: 4 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() + i);

    // Find post for this day
    const post = posts.find(
      (p) =>
        p.scheduledAt &&
        format(new Date(p.scheduledAt), "yyyy-MM-dd") ===
          format(date, "yyyy-MM-dd")
    );

    return {
      date,
      dayName: format(date, "EEE"), // Mon, Tue, etc.
      dayNumber: date.getDate(),
      post: post
        ? {
            title: post.title,
            time: format(new Date(post.scheduledAt!), "hh:mm a"),
          }
        : undefined,
      color: colorRotation[i]!,
    };
  });

  return (
    <section className="space-y-4" data-testid="dashboard-planner">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-xl font-bold">Planner</h2>
        <a href="/calendar" data-testid="dashboard-btn-open-calendar" className="p-2 glass-card rounded-lg flex items-center justify-center" aria-label="Open calendar">
          <span className="material-symbols-outlined text-lg">
            calendar_today
          </span>
        </a>
      </div>
      <div className="glass-card rounded-2xl divide-y divide-white/20">
        {days.map((day) => (
          <div key={day.date.toISOString()} data-testid={`dashboard-planner-day-${format(day.date, 'yyyy-MM-dd')}`}>
            <PlannerDay
              date={day.date}
              dayName={day.dayName}
              dayNumber={day.dayNumber}
              post={day.post}
              color={day.color}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
