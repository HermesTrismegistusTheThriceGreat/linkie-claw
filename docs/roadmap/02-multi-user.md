# Phase 2: Multi-User Support

## Goal
Refactor from single-user to multi-user — every authenticated user connects to their own data. No user can see another user's posts, generations, templates, or settings.

## Done When
Two users can log in separately and each sees only their own data, templates, and settings.

## Depends On
Phase 1 (Authentication must be in place)

---

## Step-by-Step Plan

### 2.1 — Add `user_id` Column to All Data Tables

#### 2.1.1 — Update `src/lib/db/schema.ts`

Add `user_id` foreign key to `posts` and `generations` tables:

```typescript
// In posts table:
user_id: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

// In generations table:
user_id: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
```

#### 2.1.2 — Generate and run migration
```bash
npx drizzle-kit generate
npx drizzle-kit push
```

> **Note:** If there is existing data in the database, you will need a data migration strategy. For a fresh production database, this is straightforward. For dev databases with existing data, consider making `user_id` nullable initially, backfilling it, then making it `NOT NULL`.

---

### 2.2 — Create a `getAuthUser()` Helper

Create `src/lib/auth-utils.ts`:

```typescript
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export async function getAuthUser() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session.user;
}

export async function getAuthUserId(): Promise<string> {
  const user = await getAuthUser();
  return user.id;
}
```

This centralizes auth checks and eliminates repeated `auth()` calls across components.

---

### 2.3 — Update All Database Queries

Update every function in `src/lib/db/queries.ts` to accept and filter by `userId`:

#### 2.3.1 — Posts queries

```diff
-export async function getAllPosts() {
-  return db.select().from(posts).orderBy(desc(posts.created_at));
+export async function getAllPosts(userId: string) {
+  return db.select().from(posts)
+    .where(eq(posts.user_id, userId))
+    .orderBy(desc(posts.created_at));
 }

-export async function createPost(data: NewPost) {
+export async function createPost(data: NewPost & { user_id: string }) {
   const result = await db.insert(posts).values(data).returning();
   return result[0];
 }

-export async function getPostById(id: string) {
+export async function getPostById(id: string, userId: string) {
   const result = await db.select().from(posts)
-    .where(eq(posts.id, id))
+    .where(and(eq(posts.id, id), eq(posts.user_id, userId)))
     .limit(1);
   return result[0] ?? null;
 }
```

Apply the same pattern to ALL query functions:
- `getScheduledPosts(month?, userId)`
- `getPostsByMonth(month, userId)`
- `getRecentDrafts(limit, userId)`
- `getPostsReadyToPublish(userId)` — **Careful:** This one is called by the scheduler, which may not have a user context. See Phase 9.
- `updatePost(id, data, userId)` — verify ownership before updating
- `deletePost(id, userId)` — verify ownership before deleting

#### 2.3.2 — Generations queries
Apply same `userId` filtering to:
- `createGeneration(data) → createGeneration(data & { user_id })`
- `getGenerationById(id) → getGenerationById(id, userId)`
- `getRecentGenerations(limit) → getRecentGenerations(limit, userId)`

---

### 2.4 — Update All API Routes

Every API route must extract the authenticated user and pass `userId` to queries.

#### 2.4.1 — `src/app/api/posts/route.ts`
```diff
+import { getAuthUserId } from "@/lib/auth-utils";

 export async function GET(request: NextRequest) {
+  const userId = await getAuthUserId();
   // ... existing validation ...
-  dbPosts = await getAllPosts();
+  dbPosts = await getAllPosts(userId);
 }

 export async function POST(request: NextRequest) {
+  const userId = await getAuthUserId();
   // ... existing validation ...
-  const dbPost = await createPost(dbData);
+  const dbPost = await createPost({ ...dbData, user_id: userId });
 }
```

#### 2.4.2 — `src/app/api/posts/[id]/route.ts`
```diff
+import { getAuthUserId } from "@/lib/auth-utils";

 export async function GET(request, context) {
+  const userId = await getAuthUserId();
   const { id } = await context.params;
-  const dbPost = await getPostById(id);
+  const dbPost = await getPostById(id, userId);
 }
```

Apply to PATCH and DELETE as well.

#### 2.4.3 — `src/app/api/posts/[id]/schedule/route.ts`
Add userId validation.

#### 2.4.4 — `src/app/api/posts/[id]/unschedule/route.ts`
Add userId validation.

#### 2.4.5 — `src/app/api/generate/text/route.ts` and `image/route.ts`
Add userId to generated records.

#### 2.4.6 — `src/app/api/webhooks/publish-status/route.ts`
This is called by n8n (server-to-server), so it uses a shared secret for auth, NOT user auth. Leave this using secret-based validation, but ensure it only updates posts belonging to the correct user.

---

### 2.5 — Update Page Components

#### 2.5.1 — Dashboard (`src/app/page.tsx`)
Pass userId to any server components that fetch data. Currently uses mock data, but when real data is wired up (Phase 6), it will need userId.

#### 2.5.2 — Calendar (`src/app/calendar/page.tsx`)
The calendar fetches via `/api/posts?month=...` which will now be user-scoped automatically (API route uses auth).

#### 2.5.3 — Create (`src/app/create/page.tsx`)
The create page calls `/api/posts` (POST) which will automatically attach the user. No changes needed if API routes are updated.

#### 2.5.4 — Sidebar user card (`src/components/layout/user-card.tsx`)
Already covered in Phase 1 — replace hardcoded "Alex Rivera" with session data.

---

### 2.6 — Update Mock Data Queries

`src/lib/queries/stats.ts` currently returns mock data. For now, keep mock data but associate it with the current user's session. In Phase 6, this will be replaced with real LinkedIn API data.

---

## Verification Checklist

- [ ] User A creates a post — it appears in User A's calendar
- [ ] User B logs in — User B sees an empty calendar (no User A posts)
- [ ] User B creates a post — it appears in User B's calendar
- [ ] User A refreshes — still sees only their own posts
- [ ] User A cannot access User B's post via direct API call (`/api/posts/{userB-post-id}` returns 404)
- [ ] Generation sessions are user-scoped
- [ ] Database has `user_id` column in `posts` and `generations` tables
- [ ] All API routes return 401 for unauthenticated requests
