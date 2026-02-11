import { AuroraBackground } from "@/components/layout/aurora-background";
import { Sidebar } from "@/components/layout/sidebar";
import { getAuthUser } from "@/lib/auth-utils";
import { getUserSettings } from "@/lib/db/queries";
import { SettingsHeader } from "@/components/settings/settings-header";
import { LinkedInProfileSection } from "@/components/settings/linkedin-profile-section";
import { LinkedInStatusSection } from "@/components/settings/linkedin-status-section";
import { AccountSection } from "@/components/settings/account-section";

// Client component wrapper to handle save action
import { updateLinkedInUrl } from "./actions";

export default async function SettingsPage() {
  const user = await getAuthUser();
  const settings = await getUserSettings(user.id);

  const linkedinConnected = settings?.linkedin_connected === 1;
  const linkedinProfileUrl = settings?.linkedin_profile_url ?? null;

  return (
    <AuroraBackground className="min-h-screen">
      <div className="flex" data-testid="page-settings">
        <Sidebar user={user} />
        <main className="flex-1 overflow-y-auto z-10">
          <div className="max-w-4xl mx-auto p-10 space-y-8">
            <SettingsHeader />
            
            <div className="grid grid-cols-1 gap-6">
              <LinkedInProfileSection 
                initialUrl={linkedinProfileUrl}
                onSave={updateLinkedInUrl}
              />
              
              <LinkedInStatusSection isConnected={linkedinConnected} />
              
              <AccountSection user={user} />
            </div>
          </div>
        </main>
      </div>
    </AuroraBackground>
  );
}
