# Phase 1: Production-Ready Deployment (Vercel) + Authentication

## Goal
Deploy Linkie Claw to Vercel with authentication so multiple users can sign up, log in, and see a protected dashboard.

## Done When
- App is deployed to Vercel and accessible via a public URL
- A user can sign up, log in, and see a protected dashboard
- Unauthenticated users are redirected to a login page

---

## Pre-Requisites
- Vercel account with project created
- Vercel Postgres database provisioned (via Vercel dashboard → Storage → Create → Postgres)
- Domain (optional, Vercel provides `.vercel.app` subdomain)

---

## Step-by-Step Plan

### 1.1 — Migrate Database from SQLite to PostgreSQL

**Why:** SQLite uses a local file (`./data/sunday.db`) which doesn't work on Vercel's serverless functions (ephemeral filesystem). Vercel Postgres (powered by Neon) is the recommended production database.

#### 1.1.1 — Install PostgreSQL dependencies
```bash
npm install @neondatabase/serverless drizzle-orm
npm uninstall better-sqlite3 @types/better-sqlite3
```

#### 1.1.2 — Update `drizzle.config.ts`
```diff
-import type { Config } from "drizzle-kit";
+import type { Config } from "drizzle-kit";
+import { config } from "dotenv";
+config();

 export default {
   schema: "./src/lib/db/schema.ts",
   out: "./drizzle",
-  dialect: "sqlite",
+  dialect: "postgresql",
   dbCredentials: {
-    url: "./data/sunday.db",
+    url: process.env.DATABASE_URL!,
   },
 } satisfies Config;
```

#### 1.1.3 — Update `src/lib/db/schema.ts`
Replace all `sqliteTable` imports with `pgTable` equivalents:
```diff
-import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
+import { pgTable, text, integer, timestamp, varchar } from "drizzle-orm/pg-core";

-export const posts = sqliteTable("posts", {
+export const posts = pgTable("posts", {
   id: text("id").primaryKey().$defaultFn(() => createId()),
   title: text("title").notNull(),
   content: text("content").notNull(),
   image_url: text("image_url"),
-  scheduled_at: integer("scheduled_at", { mode: "timestamp" }),
+  scheduled_at: timestamp("scheduled_at"),
-  published_at: integer("published_at", { mode: "timestamp" }),
+  published_at: timestamp("published_at"),
   status: text("status", {
     enum: ["draft", "scheduled", "publishing", "published", "failed"],
   }).notNull().default("draft"),
   linkedin_post_urn: text("linkedin_post_urn"),
   error_message: text("error_message"),
-  created_at: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
+  created_at: timestamp("created_at").notNull().$defaultFn(() => new Date()),
-  updated_at: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
+  updated_at: timestamp("updated_at").notNull().$defaultFn(() => new Date()),
 });
```

Apply the same changes to the `generations` table.

#### 1.1.4 — Update `src/lib/db/index.ts`
```diff
-import Database from "better-sqlite3";
-import { drizzle } from "drizzle-orm/better-sqlite3";
+import { neon } from "@neondatabase/serverless";
+import { drizzle } from "drizzle-orm/neon-http";
 import * as schema from "./schema";

-const sqlite = new Database("./data/sunday.db");
-export const db = drizzle(sqlite, { schema });
+const sql = neon(process.env.DATABASE_URL!);
+export const db = drizzle(sql, { schema });
```

#### 1.1.5 — Update `.env` and `.env.example`
```diff
-DATABASE_URL=file:./local.db
+DATABASE_URL=postgresql://user:password@host:5432/dbname
```

#### 1.1.6 — Generate and push new migrations
```bash
npx drizzle-kit generate
npx drizzle-kit push
```

#### 1.1.7 — Test all existing functionality
Run `npm run dev` and verify:
- Dashboard loads (mock data still works)
- Calendar loads with posts
- Create page generates text and images
- Scheduling a post works end-to-end

---

### 1.2 — Add Authentication with Auth.js v5

#### 1.2.1 — Install Auth.js
```bash
npm install next-auth@beta @auth/drizzle-adapter
```

#### 1.2.2 — Add auth tables to `src/lib/db/schema.ts`
Add the standard Auth.js tables required by the Drizzle adapter:

```typescript
export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified"),
  image: text("image"),
  created_at: timestamp("created_at").notNull().$defaultFn(() => new Date()),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  sessionToken: text("session_token").notNull().unique(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires").notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull().unique(),
  expires: timestamp("expires").notNull(),
});
```

#### 1.2.3 — Create `src/auth.ts` (Auth.js config)
```typescript
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [Google, GitHub],
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

#### 1.2.4 — Create API route handler `src/app/api/auth/[...nextauth]/route.ts`
```typescript
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

#### 1.2.5 — Create `src/middleware.ts` (protect routes)
```typescript
export { auth as middleware } from "@/auth";

export const config = {
  matcher: [
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
```

> **Note for Next.js 16:** If using `proxy.ts` instead of `middleware.ts`, adapt accordingly. The middleware approach works with Next.js 16 in compatibility mode.

#### 1.2.6 — Create login page `src/app/login/page.tsx`
Build a styled login page matching the app's Aurora design:
- Google sign-in button
- GitHub sign-in button
- Uses the existing glass-card design system
- Centered layout with the app logo

#### 1.2.7 — Update `src/app/layout.tsx`
Wrap children with `SessionProvider`:
```typescript
import { SessionProvider } from "next-auth/react";
import { auth } from "@/auth";

export default async function RootLayout({ children }) {
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

#### 1.2.8 — Update user-card component
Replace the hardcoded "Alex Rivera" with real session data:
```typescript
import { auth } from "@/auth";

export async function UserCard() {
  const session = await auth();
  const user = session?.user;
  // Use user.name, user.email, user.image
}
```

#### 1.2.9 — Add environment variables
```
AUTH_SECRET=<generate with `npx auth secret`>
AUTH_GOOGLE_ID=<Google OAuth client ID>
AUTH_GOOGLE_SECRET=<Google OAuth client secret>
AUTH_GITHUB_ID=<GitHub OAuth app ID>
AUTH_GITHUB_SECRET=<GitHub OAuth app secret>
```

---

### 1.3 — Vercel Deployment Configuration

#### 1.3.1 — Update `next.config.ts`
```typescript
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
};
```

#### 1.3.2 — Create `vercel.json` (if needed)
```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "framework": "nextjs"
}
```

#### 1.3.3 — Set Vercel environment variables
In the Vercel dashboard, configure all environment variables from `.env`:
- `DATABASE_URL` (from Vercel Postgres)
- `AUTH_SECRET`
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
- `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `N8N_WEBHOOK_URL` (production n8n URL)
- `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET`
- `N8N_CALLBACK_SECRET`

#### 1.3.4 — Security hardening
- Ensure `.env` is in `.gitignore` (already done ✅)
- Remove all API keys from committed code (check `.env` file — **CRITICAL:** the current `.env` contains real API keys that should NOT be committed)
- Add `Content-Security-Policy` headers via `next.config.ts`
- Enable HTTPS-only cookies for auth sessions

#### 1.3.5 — Deploy
```bash
npx vercel --prod
```
Or connect GitHub repo to Vercel for automatic deployments.

---

## Verification Checklist

- [ ] App builds successfully with `npm run build`
- [ ] App deploys to Vercel without errors
- [ ] Visiting the root URL redirects to `/login`
- [ ] User can sign in with Google
- [ ] User can sign in with GitHub
- [ ] After sign-in, user sees the Dashboard
- [ ] User card shows real name and avatar
- [ ] Calendar page loads correctly with PostgreSQL
- [ ] Create page generates text and images
- [ ] Signing out redirects back to login
- [ ] Database tables exist in Vercel Postgres (check via Drizzle Studio or Vercel dashboard)

---

## Security Notes

> [!CAUTION]
> The current `.env` file contains **real API keys and secrets** (OpenAI, Anthropic, GitHub PAT, Cloudflare, etc.) that are committed to the repository. Before deploying:
> 1. Rotate ALL exposed keys immediately
> 2. Move all secrets to Vercel environment variables
> 3. Ensure `.env` is in `.gitignore` and remove it from git history if committed
> 4. Use `NEXT_PUBLIC_` prefix ONLY for client-safe variables (none of the current ones qualify)
