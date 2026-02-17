# Phase 3: Multi-User Support

## Goal
Refactor from single-user to multi-user — every authenticated user connects to their own data. No user can see another user's posts, generations, templates, or settings.

## Done When
Two users can log in separately and each sees only their own data, templates, and settings.

## Depends On
Phase 2 (Authentication) — auth must be functional to get userId from sessions

---

## Step-by-Step Plan

### 3.1 — Schema Note

The user_id foreign key columns on posts and generations tables are defined in Phase 1 (Database Schema Foundation). This phase implements the query-level and route-level multi-user filtering.

Phase 1 handles the schema migration with a fresh database start. No data migration is needed in this phase.

---

### 3.2 — Create a `getAuthUser()` Helper

Create `src/lib/auth-utils.ts`:

```typescript
import { auth } from "@/lib/auth";
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

### 3.3 — Update All Database Queries

Update every function in `src/lib/db/queries.ts` to accept and filter by `userId`:

#### 3.3.1 — Posts queries

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
- `getPostsReadyToPublish(userId)` — **Careful:** This one is called by the scheduler, which may not have a user context. See Phase 6.
- `updatePost(id, data, userId)` — verify ownership before updating
- `deletePost(id, userId)` — verify ownership before deleting

#### 3.3.2 — Generations queries
Apply same `userId` filtering to:
- `createGeneration(data) → createGeneration(data & { user_id })`
- `getGenerationById(id) → getGenerationById(id, userId)`
- `getRecentGenerations(limit) → getRecentGenerations(limit, userId)`

---

### 3.4 — Update All API Routes

Every API route must extract the authenticated user and pass `userId` to queries.

#### 3.4.1 — `src/app/api/posts/route.ts`
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

#### 3.4.2 — `src/app/api/posts/[id]/route.ts`
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

#### 3.4.3 — `src/app/api/posts/[id]/schedule/route.ts`
Add userId validation.

#### 3.4.4 — `src/app/api/posts/[id]/unschedule/route.ts`
Add userId validation.

#### 3.4.5 — `src/app/api/generate/text/route.ts` and `image/route.ts`
Add userId to generated records.

#### 3.4.6 — `src/app/api/webhooks/publish-status/route.ts`
This is called by n8n (server-to-server), so it uses a shared secret for auth, NOT user auth. Leave this using secret-based validation, but ensure it only updates posts belonging to the correct user.

---

### 3.5 — Update Page Components

#### 3.5.1 — Dashboard (`src/app/page.tsx`)
Pass userId to any server components that fetch data. Currently uses mock data, but when real data is wired up (Phase 7), it will need userId.

#### 3.5.2 — Calendar (`src/app/calendar/page.tsx`)
The calendar fetches via `/api/posts?month=...` which will now be user-scoped automatically (API route uses auth).

#### 3.5.3 — Create (`src/app/create/page.tsx`)
The create page calls `/api/posts` (POST) which will automatically attach the user. No changes needed if API routes are updated.

#### 3.5.4 — Sidebar user card (`src/components/layout/user-card.tsx`)
Already covered in Phase 2 — replace hardcoded "Alex Rivera" with session data.

---

### 3.6 — Update Mock Data Queries

`src/lib/queries/stats.ts` currently returns mock data. For now, keep mock data but associate it with the current user's session. In Phase 7, this will be replaced with real LinkedIn API data.

---

## Verification Checklist

- [ ] User A creates a post — it appears in User A's calendar
- [ ] User B logs in — User B sees an empty calendar (no User A posts)
- [ ] User B creates a post — it appears in User B's calendar
- [ ] User A refreshes — still sees only their own posts
- [ ] User A cannot access User B's post via direct API call (`/api/posts/{userB-post-id}` returns 404)
- [ ] Generation sessions are user-scoped
- [ ] SQLite database has `user_id` column in `posts` and `generations` tables
- [ ] All API routes return 401 for unauthenticated requests
