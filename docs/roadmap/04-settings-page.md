# Phase 4: Settings Page — LinkedIn Profile & API Configuration

## Goal
Build a Settings page where each user can save their LinkedIn profile URL, initiate OAuth, see connection status, and have all settings persisted per-user.

## Done When
A user can save their LinkedIn URL, initiate OAuth, see a "Connected" status, and all data persists on reload.

## Depends On
Phase 2 (multi-user support for per-user settings storage)

---

## Step-by-Step Plan

### 4.1 — Add `user_settings` Table

#### 4.1.1 — Update `src/lib/db/schema.ts`
```typescript
export const userSettings = pgTable("user_settings", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  user_id: text("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  linkedin_profile_url: text("linkedin_profile_url"),
  linkedin_oauth_status: text("linkedin_oauth_status", {
    enum: ["disconnected", "pending", "connected", "expired", "error"],
  }).notNull().default("disconnected"),
  linkedin_access_token: text("linkedin_access_token"),
  linkedin_refresh_token: text("linkedin_refresh_token"),
  linkedin_token_expires_at: timestamp("linkedin_token_expires_at"),
  linkedin_person_urn: text("linkedin_person_urn"),
  updated_at: timestamp("updated_at").notNull().$defaultFn(() => new Date()),
});

export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
```

> **Security:** Access tokens and refresh tokens should be encrypted at rest. Use the existing `ENCRYPTION_KEY` env var to encrypt/decrypt these values.

#### 4.1.2 — Generate migration
```bash
npx drizzle-kit generate
npx drizzle-kit push
```

---

### 4.2 — Create Settings Queries

Create `src/lib/queries/settings.ts`:

```typescript
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function getUserSettings(userId: string) {
  const result = await db.select().from(userSettings)
    .where(eq(userSettings.user_id, userId))
    .limit(1);
  return result[0] ?? null;
}

export async function upsertUserSettings(userId: string, data: Partial<NewUserSettings>) {
  const existing = await getUserSettings(userId);
  if (existing) {
    return db.update(userSettings)
      .set({ ...data, updated_at: new Date() })
      .where(eq(userSettings.user_id, userId))
      .returning();
  }
  return db.insert(userSettings)
    .values({ user_id: userId, ...data })
    .returning();
}
```

---

### 4.3 — Create Settings API Routes

#### 4.3.1 — `src/app/api/settings/route.ts`

**GET** — Fetch current user's settings:
```typescript
export async function GET() {
  const userId = await getAuthUserId();
  const settings = await getUserSettings(userId);
  return NextResponse.json(settings ?? { linkedinOauthStatus: "disconnected" });
}
```

**PATCH** — Update settings (LinkedIn URL):
```typescript
export async function PATCH(request: NextRequest) {
  const userId = await getAuthUserId();
  const body = await request.json();
  // Validate with Zod
  const result = await upsertUserSettings(userId, {
    linkedin_profile_url: body.linkedinProfileUrl,
  });
  return NextResponse.json(result);
}
```

#### 4.3.2 — `src/app/api/settings/linkedin/connect/route.ts`
**POST** — Initiate LinkedIn OAuth flow (handled in Phase 5, but create the route stub here):
```typescript
export async function POST() {
  // Phase 5 will implement the actual OAuth flow via n8n
  return NextResponse.json({ message: "OAuth flow not yet configured" }, { status: 501 });
}
```

---

### 4.4 — Build Settings Page UI

#### 4.4.1 — Enable the sidebar link
In `src/components/layout/sidebar.tsx`, remove `disabled: true` from the Settings nav item:
```diff
-  { href: "/settings", icon: "settings", label: "Settings", disabled: true },
+  { href: "/settings", icon: "settings", label: "Settings" },
```

#### 4.4.2 — Create `src/app/settings/page.tsx`

Structure:
```
Settings Page
├── Header: "Settings" with subtitle
├── Section: LinkedIn Profile
│   ├── Input: LinkedIn Profile URL
│   ├── Button: Save URL
│   └── Success/error feedback
├── Section: LinkedIn API Connection
│   ├── Connection status indicator (disconnected/pending/connected/expired/error)
│   ├── Button: Connect LinkedIn (initiates OAuth)
│   ├── Connected account info (when connected): name, profile picture
│   └── Button: Disconnect
└── Section: Account Info
    ├── Display: Name, email, avatar (from Auth.js session)
    └── Button: Sign Out
```

#### 4.4.3 — Design consistent with existing app

Use the same design components as Dashboard:
- `AuroraBackground` wrapper
- `Sidebar` component
- `glass-card` for sections
- Primary color for action buttons
- Material Symbols icons
- Plus Jakarta Sans font

#### 4.4.4 — Create settings components

Create `src/components/settings/` directory:
- `linkedin-profile-section.tsx` — URL input + save button
- `linkedin-connection-section.tsx` — OAuth status + connect/disconnect
- `account-section.tsx` — User info + sign out
- `settings-header.tsx` — Page header

#### 4.4.5 — LinkedIn connection status display

```tsx
// Connection status badge
function ConnectionBadge({ status }: { status: string }) {
  const config = {
    disconnected: { label: "Not Connected", color: "gray", icon: "link_off" },
    pending: { label: "Connecting...", color: "yellow", icon: "hourglass_top" },
    connected: { label: "Connected", color: "green", icon: "check_circle" },
    expired: { label: "Token Expired", color: "orange", icon: "warning" },
    error: { label: "Error", color: "red", icon: "error" },
  };
  // Render with appropriate styling
}
```

---

### 4.5 — Add Zod Validation

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
- [ ] Connect LinkedIn button exists (can be non-functional until Phase 5)
- [ ] Account section shows the logged-in user's name, email, and avatar
- [ ] Sign Out button works and redirects to login
- [ ] Each user sees their own settings (not another user's)
- [ ] All interactive elements have `data-testid` attributes
