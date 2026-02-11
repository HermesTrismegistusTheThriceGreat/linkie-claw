"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { UserCard } from "./user-card";

interface NavItem {
  href: string;
  icon: string;
  label: string;
  disabled?: boolean;
}

const navItems: NavItem[] = [
  { href: "/", icon: "dashboard", label: "Dashboard" },
  { href: "/calendar", icon: "calendar_month", label: "Content Calendar" },
  { href: "/analytics", icon: "insights", label: "Analytics", disabled: true },
  { href: "/create", icon: "auto_fix", label: "AI Writer" },
  { href: "/settings", icon: "settings", label: "Settings", disabled: true },
];

interface SidebarProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-72 glass-card border-r border-white/20 flex-col z-10 sticky top-0 h-screen">
      {/* Logo Block */}
      <div className="p-8 flex items-center gap-3">
        <div className="size-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/30">
          <span className="material-symbols-outlined text-2xl font-bold">
            edit
          </span>
        </div>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight">
            Creator Studio
          </h1>
          <p className="text-xs text-primary font-semibold uppercase tracking-widest">
            Influencer Pro
          </p>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-4 py-4 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const testId = `sidebar-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`;

          if (item.disabled) {
            return (
              <div
                key={item.href}
                data-testid={testId}
                className="flex items-center gap-3 px-4 py-3 rounded-xl opacity-50 cursor-not-allowed"
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className="font-medium text-sm">{item.label}</span>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={testId}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20 font-bold"
                  : "hover:bg-white/40 font-medium"
              )}
            >
              <span
                className={cn(
                  "material-symbols-outlined",
                  isActive && "fill-1"
                )}
              >
                {item.icon}
              </span>
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Card */}
      <div className="px-4 pb-4" data-testid="sidebar-user-card">
        <UserCard name={user?.name} email={user?.email} image={user?.image} />
      </div>

      {/* Bottom CTA */}
      <div className="px-6 pb-6">
        <Link
          href="/create"
          data-testid="sidebar-btn-new-post"
          className="w-full py-4 bg-primary text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-primary/25 hover:scale-[1.02] active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-xl">add</span>
          <span>New Post</span>
        </Link>
      </div>
    </aside>
  );
}
