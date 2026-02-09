interface UserCardProps {
  name?: string;
  tier?: string;
  avatarUrl?: string;
}

export function UserCard({
  name = "Alex Rivera",
  tier = "Premium Creator",
  avatarUrl = "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
}: UserCardProps) {
  return (
    <div className="glass-card p-4 rounded-2xl flex flex-col gap-3">
      {/* User Info */}
      <div className="flex items-center gap-3">
        <div
          className="size-10 rounded-full bg-cover bg-center flex-shrink-0"
          style={{ backgroundImage: `url('${avatarUrl}')` }}
          role="img"
          aria-label={`${name}'s avatar`}
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold truncate">{name}</p>
          <p className="text-[10px] opacity-60 truncate">{tier}</p>
        </div>
      </div>

      {/* Upgrade Button */}
      <button
        type="button"
        className="w-full py-2 bg-primary/10 text-primary text-xs font-bold rounded-lg hover:bg-primary/20 transition-colors"
        aria-label="Upgrade your plan"
      >
        Upgrade Plan
      </button>
    </div>
  );
}
