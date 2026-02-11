"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LinkedInProfileSectionProps {
  initialUrl: string | null;
  onSave: (url: string) => Promise<void>;
}

export function LinkedInProfileSection({ initialUrl, onSave }: LinkedInProfileSectionProps) {
  const [url, setUrl] = useState(initialUrl || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus("idle");
    
    try {
      await onSave(url);
      setSaveStatus("success");
      // Clear success message after 3 seconds
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section 
      className="glass-card rounded-2xl p-6 space-y-4"
      data-testid="settings-linkedin-profile-section"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="size-10 bg-blue-600/10 rounded-xl flex items-center justify-center">
          <span className="material-symbols-outlined text-blue-600">badge</span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">LinkedIn Profile</h2>
          <p className="text-sm text-slate-600">Your LinkedIn profile URL for reference</p>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="linkedin-url" className="text-sm font-medium text-slate-700 block">
          LinkedIn Profile URL
        </label>
        <Input
          id="linkedin-url"
          data-testid="settings-input-linkedin-url"
          type="url"
          placeholder="https://www.linkedin.com/in/your-profile"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="bg-white/50 border-slate-200"
          aria-label="LinkedIn profile URL"
        />
        <p className="text-xs text-slate-500">
          Enter your full LinkedIn profile URL (e.g., https://www.linkedin.com/in/johndoe)
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Button
          data-testid="settings-btn-save-linkedin"
          onClick={handleSave}
          disabled={isSaving}
          className="bg-primary hover:bg-primary/90 text-white"
          aria-busy={isSaving}
        >
          {isSaving ? (
            <>
              <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
              Saving...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined mr-2">save</span>
              Save URL
            </>
          )}
        </Button>

        {saveStatus === "success" && (
          <span 
            data-testid="settings-linkedin-save-success"
            className="text-sm text-green-600 flex items-center gap-1"
            aria-live="polite"
          >
            <span className="material-symbols-outlined text-sm">check_circle</span>
            Saved successfully!
          </span>
        )}

        {saveStatus === "error" && (
          <span 
            data-testid="settings-linkedin-save-error"
            className="text-sm text-red-600 flex items-center gap-1"
            aria-live="polite"
          >
            <span className="material-symbols-outlined text-sm">error</span>
            Failed to save. Try again.
          </span>
        )}
      </div>
    </section>
  );
}
