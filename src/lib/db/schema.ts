import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

export const posts = sqliteTable("posts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  title: text("title").notNull(),
  content: text("content").notNull(),
  image_url: text("image_url"),
  scheduled_at: integer("scheduled_at", { mode: "timestamp" }),
  published_at: integer("published_at", { mode: "timestamp" }),
  status: text("status", {
    enum: ["draft", "scheduled", "publishing", "published", "failed"],
  })
    .notNull()
    .default("draft"),
  linkedin_post_urn: text("linkedin_post_urn"),
  error_message: text("error_message"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updated_at: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const generations = sqliteTable("generations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  idea: text("idea").notNull(),
  text_variations_json: text("text_variations_json").notNull(),
  images_json: text("images_json").notNull(),
  selected_text_id: text("selected_text_id"),
  selected_image_id: text("selected_image_id"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Type inference from schema
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Generation = typeof generations.$inferSelect;
export type NewGeneration = typeof generations.$inferInsert;
