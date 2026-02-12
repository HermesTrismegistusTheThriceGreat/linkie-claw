import { auth } from "@/lib/auth";
import { getUserSettings } from "@/lib/db/queries";

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

export async function Header() {
  const session = await auth();
  const settings = session?.user?.id ? await getUserSettings(session.user.id) : null;
  const greeting = getGreeting();

  return (
    <header className="flex flex-wrap items-end justify-between gap-4" data-testid="dashboard-header">
      <div className="space-y-1">
        <h1 className="text-4xl font-black tracking-tight" data-testid="dashboard-greeting">
          {greeting}, Creator 👋
        </h1>
        <p className="text-lg text-slate-500">
          Your Aurora UI dashboard is ready for some fresh content.
        </p>
      </div>
      {settings?.linkedin_profile_url ? (
        <a
          href={settings.linkedin_profile_url}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="dashboard-link-view-profile"
          className="flex items-center gap-2 px-6 py-3 glass-card rounded-xl font-bold text-sm hover:bg-white/80 transition-colors"
        >
          <span className="material-symbols-outlined">visibility</span>
          View Public Profile
        </a>
      ) : (
        <button
          disabled
          className="flex items-center gap-2 px-6 py-3 glass-card rounded-xl font-bold text-sm opacity-50 cursor-not-allowed"
          title="Add your LinkedIn profile in Settings to enable this button"
        >
          <span className="material-symbols-outlined">visibility</span>
          View Public Profile
        </button>
      )}
    </header>
  );
}
