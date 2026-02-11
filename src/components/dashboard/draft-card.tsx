import type { Draft } from "@/types/post";

interface DraftCardProps {
  draft: Draft;
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return "just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

export function DraftCard({ draft }: DraftCardProps) {
  const relativeTime = getRelativeTime(draft.updatedAt);

  return (
    <div data-testid={`dashboard-draft-${draft.id}`} className="glass-card p-4 rounded-2xl space-y-3 group cursor-pointer hover:border-primary/50 transition-colors">
      <div
        className="w-full aspect-[16/10] bg-center bg-cover rounded-xl shadow-inner overflow-hidden relative"
        style={{ backgroundImage: `url("${draft.imageUrl ?? "/placeholder-image.jpg"}")` }}
      >
        <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-tight text-slate-800">
          Draft
        </div>
      </div>
      <div className="space-y-1">
        <h4 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">
          {draft.title}
        </h4>
        <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
          <span>{draft.characterCount} characters</span>
          <span className="size-1 bg-slate-300 rounded-full"></span>
          <span>Edited {relativeTime}</span>
        </div>
        <div className="pt-2 flex gap-2">
          <button data-testid={`dashboard-draft-${draft.id}-btn-edit`} className="flex-1 py-2 bg-slate-100 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors">
            Edit
          </button>
          <button data-testid={`dashboard-draft-${draft.id}-btn-schedule`} className="flex-1 py-2 bg-primary/10 text-primary rounded-lg text-xs font-bold hover:bg-primary/20 transition-colors">
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
