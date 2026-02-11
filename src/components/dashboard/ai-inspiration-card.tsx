import Link from "next/link";

export function AiInspirationCard() {
  return (
    <div data-testid="dashboard-ai-inspiration" className="bg-gradient-to-br from-primary to-orange-400 p-6 rounded-2xl text-white shadow-lg relative overflow-hidden group">
      <span className="material-symbols-outlined absolute -bottom-4 -right-4 text-9xl opacity-10 group-hover:scale-110 transition-transform">
        lightbulb
      </span>
      <h2 className="font-black text-xl mb-2 relative z-10">
        Writer&apos;s Block?
      </h2>
      <p className="text-sm opacity-90 mb-4 relative z-10">
        Generate 5 viral LinkedIn post ideas using AI tailored to your profile.
      </p>
      <Link
        href="/create"
        data-testid="dashboard-btn-ai-ideas"
        className="inline-block px-4 py-2 bg-white text-primary font-bold rounded-lg text-sm relative z-10 hover:shadow-xl transition-all"
      >
        Try AI Ideas
      </Link>
    </div>
  );
}
