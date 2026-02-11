import Link from "next/link";
import { getRecentDrafts } from "@/lib/queries/posts";
import { DraftCard } from "./draft-card";

interface RecentDraftsProps {
  userId: string;
}

export async function RecentDrafts({ userId }: RecentDraftsProps) {
  const drafts = await getRecentDrafts(userId, 2);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-xl font-bold">Recent Drafts</h3>
        <Link
          href="/drafts"
          className="text-primary font-bold text-sm hover:underline"
        >
          See all
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {drafts.map((draft) => (
          <DraftCard key={draft.id} draft={draft} />
        ))}
      </div>
    </section>
  );
}
