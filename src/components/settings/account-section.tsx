"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/actions/auth";

interface AccountSectionProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function AccountSection({ user }: AccountSectionProps) {
  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <section 
      className="glass-card rounded-2xl p-6 space-y-4"
      data-testid="settings-account-section"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="size-10 bg-slate-600/10 rounded-xl flex items-center justify-center">
          <span className="material-symbols-outlined text-slate-600">person</span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Account</h2>
          <p className="text-sm text-slate-600">Your account information</p>
        </div>
      </div>

      <div className="flex items-center gap-4 p-4 rounded-xl bg-white/50 border border-slate-200">
        {user.image ? (
          <Image
            src={user.image}
            alt={user.name || "User avatar"}
            width={64}
            height={64}
            className="rounded-full"
            data-testid="settings-account-avatar"
          />
        ) : (
          <div 
            className="size-16 bg-primary/10 rounded-full flex items-center justify-center"
            data-testid="settings-account-avatar-placeholder"
          >
            <span className="material-symbols-outlined text-3xl text-primary">
              person
            </span>
          </div>
        )}
        
        <div className="flex-1">
          <p 
            className="font-bold text-slate-900"
            data-testid="settings-account-name"
          >
            {user.name || "Anonymous User"}
          </p>
          <p 
            className="text-sm text-slate-600"
            data-testid="settings-account-email"
          >
            {user.email || "No email provided"}
          </p>
        </div>
      </div>

      <div className="pt-2">
        <Button
          data-testid="settings-btn-sign-out"
          onClick={handleSignOut}
          variant="outline"
          className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          <span className="material-symbols-outlined mr-2">logout</span>
          Sign Out
        </Button>
      </div>
    </section>
  );
}
