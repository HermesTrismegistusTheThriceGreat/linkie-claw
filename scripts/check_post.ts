import Database from "better-sqlite3";

const db = new Database("./data/sunday.db");

// Find the emotional intelligence post
const posts = db.prepare(
    `SELECT id, title, substr(content, 1, 300) as content_preview, image_url, status, user_id, published_at, linkedin_post_urn
   FROM posts 
   WHERE content LIKE '%emotional%' OR title LIKE '%emotional%' 
   ORDER BY created_at DESC 
   LIMIT 5`
).all();

console.log("=== Emotional Intelligence Post(s) ===");
console.log(JSON.stringify(posts, null, 2));

// Also check what the Fetch Post API would return for this post
if (posts.length > 0) {
    const postId = (posts[0] as any).id;
    console.log("\n=== Full post record ===");
    const fullPost = db.prepare(`SELECT * FROM posts WHERE id = ?`).get(postId);
    console.log(JSON.stringify(fullPost, null, 2));
}
