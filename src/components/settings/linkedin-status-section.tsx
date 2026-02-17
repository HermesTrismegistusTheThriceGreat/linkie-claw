"use client";

interface LinkedInStatusSectionProps {
  isConnected: boolean;
}

export function LinkedInStatusSection({ isConnected }: LinkedInStatusSectionProps) {
  return (
    <section 
      className="glass-card rounded-2xl p-6 space-y-4"
      data-testid="settings-linkedin-status-section"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="size-10 bg-blue-600/10 rounded-xl flex items-center justify-center">
          <span className="material-symbols-outlined text-blue-600">link</span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">LinkedIn Connection</h2>
          <p className="text-sm text-slate-600">Status of your LinkedIn integration</p>
        </div>
      </div>

      <div 
        data-testid="settings-linkedin-status"
        className="flex items-center justify-between p-4 rounded-xl bg-white/50 border border-slate-200"
      >
        <div className="flex items-center gap-3">
          {isConnected ? (
            <>
              <div className="size-10 bg-green-100 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-green-600">check_circle</span>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Connected</p>
                <p className="text-sm text-slate-600">Your LinkedIn account is linked and ready for publishing</p>
              </div>
            </>
          ) : (
            <>
              <div className="size-10 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-gray-500">link_off</span>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Not Connected</p>
                <p className="text-sm text-slate-600">Your LinkedIn account is not yet linked</p>
              </div>
            </>
          )}
        </div>

        <div 
          className={`px-3 py-1 rounded-full text-xs font-bold ${
            isConnected 
              ? "bg-green-100 text-green-700" 
              : "bg-gray-100 text-gray-600"
          }`}
          data-testid="settings-linkedin-status-badge"
        >
          {isConnected ? "Active" : "Inactive"}
        </div>
      </div>

      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-600 mt-0.5">info</span>
          <div>
            <p className="text-sm font-medium text-amber-900">Managed by Admin</p>
            <p className="text-sm text-amber-700 mt-1">
              LinkedIn accounts are connected manually by your administrator in n8n. 
              If you need to connect or update your LinkedIn account, please contact your admin.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
