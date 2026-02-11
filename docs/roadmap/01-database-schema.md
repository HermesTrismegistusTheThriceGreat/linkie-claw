# Phase 1: Database Schema Foundation

## Goal
Consolidate ALL database schema work into a single upfront phase, providing stable types and schemas for every subsequent phase. This establishes the complete data model — authentication, user scoping, settings, and OAuth state management — before any application features depend on it.

## Done When
- All tables defined in `src/lib/db/schema.ts` with correct foreign keys and indexes
- Migrations generated and applied to SQLite
- All TypeScript types exported for compile-time safety
- Query function signatures updated to accept `userId` parameter
- Seed script creates test user with sample data
- `npm run typecheck` passes without errors

## Depends On
None — this is the foundation phase.

## Blocks
All subsequent phases (2-10). Every phase depends on these schema definitions.

---

## 1.1 — Purpose Statement

The database already works with two tables (`posts` and `generations`) and successfully stores posts and AI generations. **We are not replacing the database — we are extending it.**

This phase adds:
1. **Auth tables** for Auth.js v5 (users, accounts, sessions, verification tokens)
2. **User foreign keys** to existing tables (posts, generations)
3. **Settings table** for per-user LinkedIn OAuth state and preferences
4. **OAuth state table** for secure LinkedIn OAuth flow tracking
5. **Retry tracking** for the scheduler to handle transient publishing failures
6. **Indexes** for query performance on user-scoped queries

By completing all schema work upfront, every subsequent phase can:
- Import stable TypeScript types
- Write user-scoped queries without schema changes
- Build features against a complete data model
- Avoid migration churn and type breakage

---

## 1.2 — Current State

**Working tables:**
- `posts` — stores draft, scheduled, and published LinkedIn posts
- `generations` — stores AI-generated text variations and images from the Studio

**Current schema file:**
- `src/lib/db/schema.ts` — Drizzle SQLite schema with cuid2 IDs and timestamp fields

**Gap:**
- No `user_id` column — all data is globally shared
- No auth tables — no user accounts
- No settings table — no per-user OAuth tokens or preferences
- No retry tracking — scheduler cannot handle transient failures gracefully

---

## 1.3 — Schema Changes

All changes follow the existing Drizzle SQLite syntax patterns from `src/lib/db/schema.ts`.

### 1.3.1 — New Auth Tables (Auth.js v5 with @auth/drizzle-adapter)

Add these tables for Auth.js v5 compatibility:

```typescript
import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

// Users table
export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: integer("emailVerified", { mode: "timestamp" }),
  image: text("image"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// OAuth accounts table
export const accounts = sqliteTable("accounts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
});

// Sessions table
export const sessions = sqliteTable("sessions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  sessionToken: text("sessionToken").notNull().unique(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp" }).notNull(),
});

// Verification tokens table (for email login)
export const verificationTokens = sqliteTable(
  "verificationTokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull().unique(),
    expires: integer("expires", { mode: "timestamp" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);
```

**Notes:**
- `users.id` uses cuid2 (matching existing pattern)
- `accounts` stores OAuth provider data (Google, GitHub, etc.)
- `sessions` tracks active user sessions
- `verificationTokens` supports passwordless email login
- All foreign keys use `onDelete: "cascade"` for automatic cleanup

---

### 1.3.2 — Extend `posts` Table

Add two columns to the existing `posts` table:

```typescript
export const posts = sqliteTable("posts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  // ... existing columns ...

  // NEW: User foreign key
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // NEW: Retry tracking for scheduler
  retry_count: integer("retry_count")
    .notNull()
    .default(0),

  // ... existing timestamps ...
});
```

**Why these columns:**
- `user_id` — enables multi-user data scoping (Phase 2)
- `retry_count` — lets scheduler retry failed publishes up to N times (Phase 6)

---

### 1.3.3 — Extend `generations` Table

Add user foreign key to the existing `generations` table:

```typescript
export const generations = sqliteTable("generations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  // ... existing columns ...

  // NEW: User foreign key
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // ... existing timestamps ...
});
```

---

### 1.3.4 — New `user_settings` Table

Per-user settings for LinkedIn OAuth and preferences:

```typescript
export const userSettings = sqliteTable("user_settings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  user_id: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),

  // LinkedIn profile metadata
  linkedin_profile_url: text("linkedin_profile_url"),
  linkedin_person_urn: text("linkedin_person_urn"),

  // LinkedIn OAuth tokens (encrypted at application layer)
  linkedin_connected: integer("linkedin_connected").default(0), // SQLite boolean
  linkedin_access_token: text("linkedin_access_token"),
  linkedin_refresh_token: text("linkedin_refresh_token"),
  linkedin_token_expires_at: integer("linkedin_token_expires_at", { mode: "timestamp" }),
  linkedin_oauth_status: text("linkedin_oauth_status", {
    enum: ["connected", "disconnected", "expired"],
  }),

  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
```

**Notes:**
- `user_id` has a unique constraint (one settings record per user)
- Token fields are stored as text; encryption happens in application code (Phase 4)
- `linkedin_connected` is an integer (0/1) because SQLite has no native boolean type
- `linkedin_oauth_status` uses enum for type safety

---

### 1.3.5 — New `linkedin_oauth_states` Table

Tracks OAuth state parameters for CSRF protection:

```typescript
export const linkedinOauthStates = sqliteTable("linkedin_oauth_states", {
  state: text("state").primaryKey(), // Random state string
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires_at: integer("expires_at", { mode: "timestamp" }).notNull(),
});
```

**Why this table:**
- When user initiates LinkedIn OAuth, we generate a random `state` parameter
- This table stores the mapping of `state → user_id`
- When LinkedIn redirects back, we verify the state and retrieve the user
- Expired states are cleaned up by a background job (Phase 6)

---

### 1.3.6 — Add Indexes

Create indexes for common query patterns:

```typescript
import { index } from "drizzle-orm/sqlite-core";

export const posts = sqliteTable(
  "posts",
  {
    // ... columns ...
  },
  (table) => ({
    userIdIdx: index("posts_user_id_idx").on(table.user_id),
    statusIdx: index("posts_status_idx").on(table.status),
    scheduledAtIdx: index("posts_scheduled_at_idx").on(table.scheduled_at),
  })
);

export const generations = sqliteTable(
  "generations",
  {
    // ... columns ...
  },
  (table) => ({
    userIdIdx: index("generations_user_id_idx").on(table.user_id),
  })
);
```

**Why these indexes:**
- `posts_user_id_idx` — speeds up user-scoped post queries (used everywhere)
- `posts_status_idx` — speeds up scheduler queries (`WHERE status = 'scheduled'`)
- `posts_scheduled_at_idx` — speeds up scheduler time-range queries
- `generations_user_id_idx` — speeds up user-scoped generation queries

---

## 1.4 — TypeScript Type Exports

Update the bottom of `src/lib/db/schema.ts` to export inferred types:

```typescript
// Existing types (keep these)
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Generation = typeof generations.$inferSelect;
export type NewGeneration = typeof generations.$inferInsert;

// NEW: Auth types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type VerificationToken = typeof verificationTokens.$inferSelect;
export type NewVerificationToken = typeof verificationTokens.$inferInsert;

// NEW: Settings types
export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;

// NEW: OAuth state types
export type LinkedinOauthState = typeof linkedinOauthStates.$inferSelect;
export type NewLinkedinOauthState = typeof linkedinOauthStates.$inferInsert;
```

**Why this matters:**
- Every API route, component, and query function gets compile-time type checking
- Adding/removing columns automatically updates types across the codebase
- IDE autocomplete works everywhere
- Prevents typos and schema drift

---

## 1.5 — Query Function Signatures

Update `src/lib/db/queries.ts` to accept `userId` parameter. **Do not implement the query bodies yet — just update the signatures.**

### 1.5.1 — Update Existing Post Queries

```typescript
// Before:
export async function getAllPosts() { ... }
export async function getPostById(id: string) { ... }
export async function createPost(data: NewPost) { ... }
export async function updatePost(id: string, data: Partial<NewPost>) { ... }
export async function deletePost(id: string) { ... }
export async function getScheduledPosts(month?: string) { ... }
export async function getPostsByMonth(month: string) { ... }
export async function getRecentDrafts(limit: number) { ... }

// After:
export async function getAllPosts(userId: string) { ... }
export async function getPostById(id: string, userId: string) { ... }
export async function createPost(data: NewPost & { user_id: string }) { ... }
export async function updatePost(id: string, data: Partial<NewPost>, userId: string) { ... }
export async function deletePost(id: string, userId: string) { ... }
export async function getScheduledPosts(userId: string, month?: string) { ... }
export async function getPostsByMonth(month: string, userId: string) { ... }
export async function getRecentDrafts(limit: number, userId: string) { ... }
```

### 1.5.2 — Update Existing Generation Queries

```typescript
// Before:
export async function createGeneration(data: NewGeneration) { ... }
export async function getGenerationById(id: string) { ... }
export async function getRecentGenerations(limit: number) { ... }

// After:
export async function createGeneration(data: NewGeneration & { user_id: string }) { ... }
export async function getGenerationById(id: string, userId: string) { ... }
export async function getRecentGenerations(limit: number, userId: string) { ... }
```

### 1.5.3 — New Scheduler Queries

```typescript
// Get posts ready to publish (no userId — scheduler runs globally)
export async function getPostsReadyToPublish(): Promise<Post[]> {
  // Returns posts WHERE status='scheduled' AND scheduled_at <= now() AND retry_count < MAX_RETRIES
  // Ordered by scheduled_at ASC
}

// Get posts stuck in "publishing" state for too long
export async function getStalePublishingPosts(): Promise<Post[]> {
  // Returns posts WHERE status='publishing' AND updated_at < (now - 5 minutes)
  // These likely failed but didn't receive a callback
}

// Increment retry count
export async function incrementPostRetryCount(postId: string): Promise<void> {
  // UPDATE posts SET retry_count = retry_count + 1 WHERE id = postId
}
```

**Notes:**
- Scheduler queries do NOT filter by `userId` — they run globally across all users
- Scheduler respects `retry_count` to avoid infinite retry loops
- `getStalePublishingPosts` helps recover from n8n webhook failures

### 1.5.4 — New Settings Queries

```typescript
export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  // SELECT * FROM user_settings WHERE user_id = userId
}

export async function upsertUserSettings(
  userId: string,
  data: Partial<NewUserSettings>
): Promise<UserSettings> {
  // INSERT INTO user_settings (...) VALUES (...)
  // ON CONFLICT (user_id) DO UPDATE SET ...
}
```

**Implementation note:**
These will be implemented fully in Phase 4 (Settings Page), but the signatures are defined now.

---

## 1.6 — Migration Strategy

Since we are in pre-production with a local SQLite database and no production data:

### 1.6.1 — Wipe and Rebuild

```bash
# Step 1: Delete the existing SQLite database
rm linkie-claw.db

# Step 2: Generate migration files from schema
npx drizzle-kit generate

# Step 3: Push schema to database (creates new linkie-claw.db)
npx drizzle-kit push
```

**Why wipe the database:**
- Adding `user_id NOT NULL` foreign keys to existing tables requires data migration
- We have no production data to preserve
- Fresh start is simpler and faster for local development

**What happens:**
- Drizzle reads `src/lib/db/schema.ts`
- Generates SQL migration files in `drizzle/` folder
- Applies migrations to SQLite database
- Creates all tables, indexes, and foreign keys

---

### 1.6.2 — Update Seed Script

Create or update `scripts/seed.ts` to generate test data:

```typescript
import { db } from "@/lib/db/index";
import { users, posts, generations, userSettings } from "@/lib/db/schema";
import { createId } from "@paralleldrive/cuid2";

async function seed() {
  // Create test user
  const testUser = await db.insert(users).values({
    id: createId(),
    name: "Alex Rivera",
    email: "alex@example.com",
    emailVerified: new Date(),
  }).returning();

  const userId = testUser[0].id;

  // Create sample posts
  await db.insert(posts).values([
    {
      id: createId(),
      user_id: userId,
      title: "Test Post 1",
      content: "This is a test post",
      status: "draft",
      created_at: new Date(),
      updated_at: new Date(),
    },
    // ... more posts ...
  ]);

  // Create sample generation
  await db.insert(generations).values({
    id: createId(),
    user_id: userId,
    idea: "AI-powered content studio",
    text_variations_json: "[]",
    images_json: "[]",
    created_at: new Date(),
  });

  // Create user settings
  await db.insert(userSettings).values({
    id: createId(),
    user_id: userId,
    linkedin_connected: 0,
    created_at: new Date(),
    updated_at: new Date(),
  });

  console.log("✅ Database seeded");
}

seed().catch(console.error);
```

**Run seed script:**
```bash
npx tsx scripts/seed.ts
```

---

## 1.7 — Data Mapper Updates

Update `src/lib/db/mappers.ts` to handle the new `user_id` and `retry_count` fields.

### 1.7.1 — Add `user_id` to `dbToPost` Mapper

If the mapper currently transforms DB posts to API posts:

```typescript
// Before:
export function dbToPost(dbPost: Post): APIPost {
  return {
    id: dbPost.id,
    title: dbPost.title,
    content: dbPost.content,
    // ... other fields ...
  };
}

// After:
export function dbToPost(dbPost: Post): APIPost {
  return {
    id: dbPost.id,
    userId: dbPost.user_id, // Add this
    title: dbPost.title,
    content: dbPost.content,
    retryCount: dbPost.retry_count, // Add this
    // ... other fields ...
  };
}
```

### 1.7.2 — Add `user_id` to `apiToDbPost` Mapper

```typescript
// Before:
export function apiToDbPost(apiPost: APIPost): NewPost {
  return {
    title: apiPost.title,
    content: apiPost.content,
    // ... other fields ...
  };
}

// After:
export function apiToDbPost(apiPost: APIPost, userId: string): NewPost {
  return {
    user_id: userId, // Add this
    title: apiPost.title,
    content: apiPost.content,
    retry_count: 0, // Add this (default)
    // ... other fields ...
  };
}
```

**Note:** The exact structure depends on your existing mapper implementation. The key point is that `user_id` and `retry_count` must be included.

---

## 1.8 — Database Config

Ensure `drizzle.config.ts` is correctly configured for SQLite:

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: "./linkie-claw.db",
  },
});
```

**Notes:**
- `dialect: "sqlite"` — will change to `"postgresql"` in Phase 10
- `schema` path must point to the correct schema file
- `out` folder stores migration files

---

## 1.9 — Verification Checklist

After completing this phase, verify:

- [ ] `src/lib/db/schema.ts` defines all 7 tables:
  - `users`
  - `accounts`
  - `sessions`
  - `verificationTokens`
  - `posts` (with `user_id` and `retry_count`)
  - `generations` (with `user_id`)
  - `userSettings`
  - `linkedinOauthStates`
- [ ] All foreign keys reference `users.id` with `onDelete: "cascade"`
- [ ] All indexes are defined on `posts` and `generations`
- [ ] All TypeScript types are exported (18 types total)
- [ ] `src/lib/db/queries.ts` has updated function signatures (implementation in Phase 2)
- [ ] `npx drizzle-kit generate` runs without errors
- [ ] `npx drizzle-kit push` creates `linkie-claw.db` with all tables
- [ ] `npx tsx scripts/seed.ts` populates database with test user and data
- [ ] `npm run typecheck` passes without type errors
- [ ] SQLite database file exists at `./linkie-claw.db`

---

## 1.10 — Files Changed

| File | Change |
|------|--------|
| `src/lib/db/schema.ts` | Add 4 auth tables, extend posts/generations, add userSettings + linkedinOauthStates, add indexes |
| `src/lib/db/queries.ts` | Update function signatures to accept `userId`, add scheduler queries, add settings queries |
| `src/lib/db/mappers.ts` | Add `user_id` and `retry_count` to mappers |
| `drizzle.config.ts` | Verify SQLite config (no changes needed) |
| `scripts/seed.ts` | Create/update seed script with test user |
| `drizzle/` | Generated migration files (auto-created by drizzle-kit) |
| `linkie-claw.db` | SQLite database file (auto-created by drizzle-kit push) |

---

## 1.11 — Next Steps

After Phase 1 completes:

1. **Phase 2 (Multi-User)** — Implement Auth.js, add `getAuthUser()` helper, update all API routes to filter by `userId`
2. **Phase 3 (OpenClaw Compat)** — Add `data-testid` attributes for AI agent navigation
3. **Phase 4 (Settings Page)** — Implement LinkedIn OAuth status display and settings CRUD
4. **Phase 5 (Schedule Page)** — Fix calendar layout and add edit post modal
5. **Phase 6 (Node.js Scheduler)** — Implement `/api/cron/publish-scheduled` using `getPostsReadyToPublish()`
6. **Phase 7 (Dashboard)** — Replace mock stats with real DB queries
7. **Phase 8 (Analytics Page)** — Build dedicated analytics page
8. **Phase 9 (Final Polish)** — Audit and refine
9. **Phase 10 (Production Deployment)** — Migrate SQLite → PostgreSQL, deploy to production

---

## 1.12 — Critical Notes

### DO NOT modify these working systems:
- The n8n workflow (`n8n/workflows/linkedin-publish.json`) — it works and should not be changed
- The existing post publishing flow — it correctly triggers n8n and receives callbacks
- The AI generation endpoints — they correctly call Anthropic and Gemini APIs

### DO modify:
- Database schema and types
- Query function signatures (but not implementations yet — those are Phase 2)
- Seed scripts

### Migration timing:
- **Phase 1:** Define schema, generate migrations, push to SQLite
- **Phase 2:** Implement user-scoped queries using the schema
- **Phase 4:** Implement settings CRUD using the schema
- **Phase 6:** Implement scheduler using the schema
- **Phase 10:** Migrate from SQLite to PostgreSQL (schema stays the same, only dialect changes)

---

## Success Criteria

Phase 1 is complete when:

1. All 7 tables exist in SQLite with correct columns and foreign keys
2. All TypeScript types compile without errors (`npm run typecheck` passes)
3. Query function signatures accept `userId` parameter (implementations come later)
4. Seed script creates a test user with sample posts and generations
5. `linkie-claw.db` file exists and can be queried via Drizzle Studio (`npx drizzle-kit studio`)
6. No breaking changes to existing API routes or components (they will be updated in Phase 2)

**This phase provides the stable foundation for all subsequent work.**
