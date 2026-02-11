# Phase 5: Settings Page — LinkedIn Profile & Account Info

## Goal
Build a Settings page where users can save their LinkedIn profile URL, see their LinkedIn connection status, and manage account info. LinkedIn accounts are connected manually in n8n, not through OAuth in the app.

## Done When
A user can save their LinkedIn profile URL, see whether their account is connected (via n8n), and view/manage their account info. All data persists on reload.

## Depends On
Phase 3 (Multi-User Support) — per-user settings require user authentication

---

## What Changed from Original Phase 4

**REMOVED**:
- LinkedIn OAuth initiation UI (the "Connect LinkedIn" button that triggers OAuth flow)
- OAuth token fields (`oauth_access_token`, `oauth_refresh_token`, `oauth_token_expires_at`)
- OAuth status tracking enum (`disconnected`, `pending`, `connected`, `expired`, `error`)
- OAuth callback endpoints and token encryption utilities

**KEPT**:
- Settings page UI structure
- LinkedIn profile URL field
- Account info section

**ADDED**:
- Simple `linkedin_connected` boolean field (manually toggled, reflects n8n connection status)
- Informational display of connection status only

---

## Simplified Architecture

LinkedIn accounts are connected manually in n8n by the admin. The app simply stores:
- The user's LinkedIn profile URL (for reference)
- The user's LinkedIn person URN (set by admin after n8n connection)
- A connection status flag (manually set to indicate the account is configured in n8n)

This Settings page is purely for user reference and basic profile information storage.

---

## Step-by-Step Plan

### 5.1 — Database Schema

The `user_settings` table (including LinkedIn profile URL, connection status, and OAuth fields) is defined in Phase 1 (Database Schema Foundation). This phase implements the Settings page UI, API routes, and query functions.

---

### 5.2 — Create Settings Queries

Create `src/lib/db/queries/settings.ts`:

```typescript
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { NewUserSettings } from "@/lib/db/schema";

export async function getUserSettings(userId: string) {
  const result = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.user_id, userId))
    .limit(1);
  return result[0] ?? null;
}

export async function upsertUserSettings(
  userId: string,
  data: Partial<NewUserSettings>
) {
  const existing = await getUserSettings(userId);
  if (existing) {
    const result = await db
      .update(userSettings)
      .set({ ...data, updated_at: new Date() })
      .where(eq(userSettings.user_id, userId))
      .returning();
    return result[0];
  }
  const result = await db
    .insert(userSettings)
    .values({ user_id: userId, ...data })
    .returning();
  return result[0];
}
```

---

### 5.3 — Create Settings API Routes

#### 5.3.1 — `src/app/api/settings/route.ts`

**GET** — Fetch current user's settings:
```typescript
import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserSettings } from "@/lib/db/queries/settings";

export async function GET() {
  const userId = await getAuthUserId();
  const settings = await getUserSettings(userId);
  return NextResponse.json(
    settings ?? { linkedinConnected: false, linkedinProfileUrl: null }
  );
}
```

**PATCH** — Update settings (LinkedIn URL):
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { upsertUserSettings } from "@/lib/db/queries/settings";
import { updateSettingsSchema } from "@/lib/validations/settings";

export async function PATCH(request: NextRequest) {
  const userId = await getAuthUserId();
  const body = await request.json();

  // Validate with Zod
  const validated = updateSettingsSchema.parse(body);

  const result = await upsertUserSettings(userId, {
    linkedin_profile_url: validated.linkedinProfileUrl || null,
  });

  return NextResponse.json(result);
}
```

---

### 5.4 — Build Settings Page UI

#### 5.4.1 — Enable the sidebar link

In `src/components/layout/sidebar.tsx`, remove `disabled: true` from the Settings nav item:
```diff
-  { href: "/settings", icon: "settings", label: "Settings", disabled: true },
+  { href: "/settings", icon: "settings", label: "Settings" },
```

#### 5.4.2 — Create `src/app/settings/page.tsx`

Structure:
```
Settings Page
├── Header: "Settings" with subtitle
├── Section: LinkedIn Profile
│   ├── Input: LinkedIn Profile URL
│   ├── Button: Save URL
│   └── Success/error feedback
├── Section: LinkedIn Connection Status (read-only)
│   ├── Connection status indicator (connected/not connected)
│   └── Help text: "LinkedIn accounts are managed by your admin"
└── Section: Account Info
    ├── Display: Name, email, avatar (from Auth.js session)
    └── Button: Sign Out
```

#### 5.4.3 — Design consistent with existing app

Use the same design components as Dashboard:
- `AuroraBackground` wrapper
- `Sidebar` component
- `glass-card` for sections
- Primary color for action buttons
- Material Symbols icons
- Plus Jakarta Sans font

#### 5.4.4 — Create settings components

Create `src/components/settings/` directory:
- `linkedin-profile-section.tsx` — URL input + save button
- `linkedin-status-section.tsx` — Read-only connection status display
- `account-section.tsx` — User info + sign out
- `settings-header.tsx` — Page header

#### 5.4.5 — LinkedIn connection status display

```tsx
// Connection status badge (read-only, informational only)
function ConnectionBadge({ connected }: { connected: boolean }) {
  if (connected) {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <span className="material-symbols-outlined text-lg">check_circle</span>
        <span className="text-sm font-bold">Connected</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-gray-500">
      <span className="material-symbols-outlined text-lg">link_off</span>
      <span className="text-sm font-bold">Not Connected</span>
    </div>
  );
}
```

**Important:** This is purely informational. Users cannot trigger OAuth from the UI. The admin manually configures LinkedIn connections in n8n and updates the `linkedin_connected` flag via a separate admin interface or database update.

---

### 5.5 — Add Zod Validation

Create `src/lib/validations/settings.ts`:
```typescript
import { z } from "zod";

export const updateSettingsSchema = z.object({
  linkedinProfileUrl: z.string().url().optional().or(z.literal("")),
});
```

---

## Verification Checklist

- [ ] Settings link in sidebar is clickable and navigates to `/settings`
- [ ] Settings page renders with Aurora background and glass-card layout
- [ ] User can type a LinkedIn profile URL and click Save
- [ ] Saved URL persists after page refresh
- [ ] LinkedIn connection status shows "Not Connected" by default
- [ ] LinkedIn connection status shows "Connected" when flag is true
- [ ] Help text explains that LinkedIn accounts are managed by admin
- [ ] Account section shows the logged-in user's name, email, and avatar
- [ ] Sign Out button works and redirects to login
- [ ] Each user sees their own settings (not another user's)
- [ ] All interactive elements have `data-testid` attributes
- [ ] `npm run typecheck` passes with no errors
