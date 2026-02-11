"use client";

interface SettingsHeaderProps {
  title?: string;
  subtitle?: string;
}

export function SettingsHeader({ 
  title = "Settings", 
  subtitle = "Manage your account and LinkedIn integration" 
}: SettingsHeaderProps) {
  return (
    <header data-testid="settings-header">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
        {title}
      </h1>
      <p className="text-slate-600 mt-1">
        {subtitle}
      </p>
    </header>
  );
}
