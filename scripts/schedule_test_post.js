const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "..", "data", "sunday.db");
const db = new Database(dbPath);

// Schedule the post 3 minutes from now
const scheduledAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();

const stmt = db.prepare(
  "UPDATE posts SET status = 'scheduled', scheduled_at = ? WHERE id = 'test1_txt_ai_grid'"
);
const result = stmt.run(scheduledAt);

console.log("Update result:", result);
console.log("Scheduled at:", scheduledAt);

// Verify
const post = db.prepare(
  "SELECT id, title, status, scheduled_at, error_message, linkedin_post_urn, published_at FROM posts WHERE id = 'test1_txt_ai_grid'"
).get();

console.log("Post after update:", JSON.stringify(post, null, 2));

db.close();
