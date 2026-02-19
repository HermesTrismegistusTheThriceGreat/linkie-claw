import { pgTable, text, integer, primaryKey, index, timestamp, boolean } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

// ============================================================================
// Auth Tables (for Auth.js v5 with @auth/drizzle-adapter)
// ============================================================================

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: timestamp("emailVerified"),
  image: text("image"),
  created_at: timestamp("created_at")
    .notNull()
    .defaultNow(),
});

export const accounts = pgTable("accounts", {
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

export const sessions = pgTable("sessions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  sessionToken: text("sessionToken").notNull().unique(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires").notNull(),
});

export const verificationTokens = pgTable(
  "verificationTokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull().unique(),
    expires: timestamp("expires").notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// ============================================================================
// Application Tables
// ============================================================================

export const posts = pgTable(
  "posts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    image_url: text("image_url"),
    scheduled_at: timestamp("scheduled_at"),
    published_at: timestamp("published_at"),
    status: text("status", {
      enum: ["draft", "scheduled", "publishing", "published", "failed"],
    })
      .notNull()
      .default("draft"),
    linkedin_post_urn: text("linkedin_post_urn"),
    error_message: text("error_message"),
    retry_count: integer("retry_count")
      .notNull()
      .default(0),
    created_at: timestamp("created_at")
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at")
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: index("posts_user_id_idx").on(table.user_id),
    statusIdx: index("posts_status_idx").on(table.status),
    scheduledAtIdx: index("posts_scheduled_at_idx").on(table.scheduled_at),
  })
);

export const generations = pgTable(
  "generations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    idea: text("idea").notNull(),
    text_variations_json: text("text_variations_json").notNull(),
    images_json: text("images_json").notNull(),
    selected_text_id: text("selected_text_id"),
    selected_image_id: text("selected_image_id"),
    created_at: timestamp("created_at")
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: index("generations_user_id_idx").on(table.user_id),
  })
);

export const userSettings = pgTable("user_settings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  user_id: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),

  // LinkedIn profile metadata
  linkedin_profile_url: text("linkedin_profile_url"),
  linkedin_headline: text("linkedin_headline"),
  linkedin_person_urn: text("linkedin_person_urn"),

  // LinkedIn OAuth tokens (encrypted at application layer)
  linkedin_connected: boolean("linkedin_connected").default(false),
  linkedin_access_token: text("linkedin_access_token"),
  linkedin_refresh_token: text("linkedin_refresh_token"),
  linkedin_token_expires_at: timestamp("linkedin_token_expires_at"),
  linkedin_oauth_status: text("linkedin_oauth_status", {
    enum: ["connected", "disconnected", "expired"],
  }),

  voice_tones_json: text("voice_tones_json"), // JSON array of 6 VoiceTone objects, null = defaults
  image_styles_json: text("image_styles_json"), // JSON array of 6 ImageStyle objects, null = defaults

  n8n_webhook_url: text("n8n_webhook_url"), // Per-user n8n webhook URL for publishing

  created_at: timestamp("created_at")
    .notNull()
    .defaultNow(),
  updated_at: timestamp("updated_at")
    .notNull()
    .defaultNow(),
});

export const linkedinOauthStates = pgTable("linkedin_oauth_states", {
  state: text("state").primaryKey(), // Random state string
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires_at: timestamp("expires_at").notNull(),
});

// ============================================================================
// Type Exports
// ============================================================================

// Existing types
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Generation = typeof generations.$inferSelect;
export type NewGeneration = typeof generations.$inferInsert;

// Auth types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type VerificationToken = typeof verificationTokens.$inferSelect;
export type NewVerificationToken = typeof verificationTokens.$inferInsert;

// Settings types
export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;

// OAuth state types
export type LinkedinOauthState = typeof linkedinOauthStates.$inferSelect;
export type NewLinkedinOauthState = typeof linkedinOauthStates.$inferInsert;
