import { signOut } from "@/app/actions/auth";

interface UserCardProps {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export function UserCard({ name, email, image }: UserCardProps) {
  const displayName = name || email || "User";
  const avatarUrl =
    image ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`;

  return (
    <div className="glass-card p-4 rounded-2xl flex flex-col gap-3">
      {/* User Info */}
      <div className="flex items-center gap-3">
        <div
          className="size-10 rounded-full bg-cover bg-center flex-shrink-0"
          style={{ backgroundImage: `url('${avatarUrl}')` }}
          role="img"
          aria-label={`${displayName}'s avatar`}
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold truncate">{displayName}</p>
          <p className="text-[10px] opacity-60 truncate">{email}</p>
        </div>
      </div>

      {/* Sign Out Button */}
      <form action={signOut}>
        <button
          type="submit"
          data-testid="sidebar-btn-sign-out"
          className="w-full py-2 flex items-center justify-center gap-2 bg-primary/10 text-primary text-xs font-bold rounded-lg hover:bg-primary/20 transition-colors"
          aria-label="Sign out"
        >
          Sign Out
        </button>
      </form>
    </div>
  );
}
