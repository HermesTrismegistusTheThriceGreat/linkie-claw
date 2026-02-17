# Phase 2: Authentication (Auth.js v5 + SQLite)

## Goal
Add authentication to Linkie Claw so users can sign up, log in, and access a protected app — all running locally with SQLite. Users will authenticate via Google or GitHub OAuth providers.

## Done When
- A user can sign up and log in using Google or GitHub
- Unauthenticated users are redirected to a login page
- Authenticated users see the dashboard with their real profile information
- All auth data is stored in the local SQLite database

---

## Pre-Requisites
- Google OAuth credentials (Client ID + Secret) — supports `http://localhost:3000` redirect URI
- GitHub OAuth app credentials (Client ID + Secret) — supports `http://localhost:3000` redirect URI
- Auth.js secret (generate with `npx auth secret`)

---

## Depends On
Phase 1 (Database Schema Foundation) — auth tables must exist

---

## Step-by-Step Plan

### 2.1 — Install Auth.js Dependencies

```bash
npm install next-auth@beta @auth/drizzle-adapter
```

**Important:** Do NOT remove `better-sqlite3` — we are keeping SQLite for local development.

---

### 2.2 — Schema Note

All auth tables (users, accounts, sessions, verificationTokens) are defined in Phase 1 (Database Schema Foundation). This phase implements the Auth.js configuration and application integration.

---

### 2.3 — Create Auth.js Configuration

Create `src/lib/auth.ts` with Auth.js config using Google and GitHub providers, and the Drizzle adapter pointing to the existing SQLite database.

```typescript
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});
```

---

### 2.4 — Create API Route Handler

Create `src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

---

### 2.5 — Create Middleware to Protect Routes

Create `src/middleware.ts` to protect all routes except `/login` and `/api/auth`:

```typescript
export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
```

> **Note for Next.js 16:** If using `proxy.ts` instead of `middleware.ts`, adapt accordingly. The middleware approach works with Next.js 16 in compatibility mode.

---

### 2.6 — Create Login Page

Create `src/app/login/page.tsx` with a styled login page matching the app's Aurora design language:

- Glass card design with aurora background
- Google sign-in button
- GitHub sign-in button
- App logo and branding
- Centered layout

Example structure:
```tsx
import { signIn } from "@/lib/auth";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="glass-card p-8">
        <h1>Sign in to Linkie Claw</h1>
        <form action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}>
          <button type="submit">Sign in with Google</button>
        </form>
        <form action={async () => {
          "use server";
          await signIn("github", { redirectTo: "/" });
        }}>
          <button type="submit">Sign in with GitHub</button>
        </form>
      </div>
    </div>
  );
}
```

---

### 2.7 — Update Root Layout with SessionProvider

Update `src/app/layout.tsx` to wrap children with `SessionProvider`:

```typescript
import { SessionProvider } from "next-auth/react";
import { auth } from "@/lib/auth";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  return (
    <html lang="en">
      <body>
        <SessionProvider session={session}>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
```

---

### 2.8 — Update User Card Component

Update `src/components/layout/user-card.tsx` to replace the hardcoded "Alex Rivera" with real session data:

```typescript
import { auth } from "@/lib/auth";

export async function UserCard() {
  const session = await auth();
  const user = session?.user;

  return (
    <div className="user-card">
      {user?.image && <img src={user.image} alt={user.name || "User"} />}
      <div>
        <p>{user?.name || "User"}</p>
        <p>{user?.email}</p>
      </div>
    </div>
  );
}
```

---

### 2.9 — Add Environment Variables

Update `.env` and `.env.example`:

```bash
# Auth.js
AUTH_SECRET=<generate with `npx auth secret`>
AUTH_GOOGLE_ID=<Google OAuth client ID>
AUTH_GOOGLE_SECRET=<Google OAuth client secret>
AUTH_GITHUB_ID=<GitHub OAuth app ID>
AUTH_GITHUB_SECRET=<GitHub OAuth app secret>

# Existing variables remain unchanged
DATABASE_URL=file:./data/sunday.db
# ... other variables
```

**For local OAuth setup**:
- Google: Add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI
- GitHub: Add `http://localhost:3000/api/auth/callback/github` as a callback URL

---

## Verification Checklist

- [ ] `npm run build` succeeds
- [ ] App redirects to `/login` when not authenticated
- [ ] Google sign-in works (localhost callback)
- [ ] GitHub sign-in works (localhost callback)
- [ ] After login, user sees dashboard
- [ ] User card shows real name and avatar from session
- [ ] Sign out returns to login page
- [ ] Auth tables exist in SQLite database (`./data/sunday.db`)
- [ ] `npm run typecheck` passes

---

## Action Item (Outside Codebase)

**Action Item (Outside Codebase):** Apply for LinkedIn Community Management API access at https://www.linkedin.com/developers/ during this phase. Approval takes 2-4 weeks; applying now ensures access is ready by Phase 8 (Analytics Page).

---

## What Changed from Original Phase 1

**REMOVED** (moved to Phase 10):
- Vercel deployment configuration
- SQLite → PostgreSQL migration
- Remote image patterns in `next.config.ts`
- `vercel.json` configuration
- Security hardening for production
- Vercel environment variable setup

**REMOVED** (moved to Phase 1):
- Database schema definitions for auth tables

**KEPT**:
- Auth.js v5 setup
- Login page
- Middleware for route protection
- SessionProvider
- User card updates

**CHANGED**:
- Use `@auth/drizzle-adapter` with SQLite instead of PostgreSQL/Neon
- Auth tables are now defined in Phase 1 (Database Schema Foundation)
- Database adapter points to existing SQLite database (`./data/sunday.db`)
- All authentication runs locally on `localhost:3000`
- Dependencies updated to reflect Phase 1 schema work
