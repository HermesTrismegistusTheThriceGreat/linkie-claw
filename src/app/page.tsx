import { AuroraBackground } from "@/components/layout/aurora-background";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/dashboard/header";
import { StatsRow } from "@/components/dashboard/stats-row";
import { RecentDrafts } from "@/components/dashboard/recent-drafts";
import { FollowerChart } from "@/components/dashboard/follower-chart";
import { PlannerWidget } from "@/components/dashboard/planner-widget";
import { AiInspirationCard } from "@/components/dashboard/ai-inspiration-card";
import { getAuthUser } from "@/lib/auth-utils";

export default async function DashboardPage() {
  const user = await getAuthUser();

  return (
    <AuroraBackground className="min-h-screen">
      <div className="flex" data-testid="page-dashboard">
        <Sidebar user={user} />
        <main className="flex-1 overflow-y-auto z-10">
          <div className="max-w-6xl mx-auto p-10 space-y-8">
            <Header />
            <StatsRow />
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              <section className="xl:col-span-2 space-y-4">
                <RecentDrafts userId={user.id} />
                <FollowerChart />
              </section>
              <section className="space-y-4">
                <PlannerWidget userId={user.id} />
                <AiInspirationCard />
              </section>
            </div>
          </div>
        </main>
      </div>
    </AuroraBackground>
  );
}
