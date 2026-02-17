import Link from "next/link";

/**
 * Floating Action Button for creating new posts.
 * Fixed position bottom-right with coral gradient and hover scale effect.
 */
export function Fab() {
  return (
    <Link
      href="/create"
      data-testid="calendar-fab-create-post"
      className="fixed bottom-10 right-10 z-30 flex size-14 items-center justify-center rounded-full bg-[#ee5b2b] text-white shadow-2xl transition-transform hover:scale-110"
      aria-label="Create new post"
    >
      <span className="material-symbols-outlined text-3xl">add</span>
    </Link>
  );
}
