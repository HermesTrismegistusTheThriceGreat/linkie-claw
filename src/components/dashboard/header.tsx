function getGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  } else if (hour < 18) {
    return "Good afternoon";
  } else {
    return "Good evening";
  }
}

export function Header() {
  const greeting = getGreeting();

  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        <h2 className="text-4xl font-black tracking-tight">
          {greeting}, Creator 👋
        </h2>
        <p className="text-lg text-slate-500">
          Your Aurora UI dashboard is ready for some fresh content.
        </p>
      </div>
      <button className="flex items-center gap-2 px-6 py-3 glass-card rounded-xl font-bold text-sm hover:bg-white/80 transition-colors">
        <span className="material-symbols-outlined">visibility</span>
        View Public Profile
      </button>
    </header>
  );
}
