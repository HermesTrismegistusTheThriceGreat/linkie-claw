import { db } from "@/lib/db";
import { users, posts, generations, userSettings } from "@/lib/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { addDays } from "date-fns";

async function seed() {
  console.log("🌱 Seeding database...");

  // Create test user
  const testUser = await db
    .insert(users)
    .values({
      id: createId(),
      name: "Joseph Seager",
      email: "seagerjoe@gmail.com",
      emailVerified: new Date(),
      image: null,
    })
    .returning();

  if (!testUser[0]) {
    throw new Error("Failed to create test user");
  }
  const userId = testUser[0].id;
  console.log("✅ Created test user:", userId);

  // Create sample posts with different statuses
  const now = new Date();

  await db.insert(posts).values([
    {
      id: createId(),
      user_id: userId,
      title: "Getting Started with AI-Powered Content",
      content:
        "Excited to share how AI is transforming content creation! 🚀 In this thread, I'll break down:\n\n• How to leverage AI for ideation\n• Tools that actually work\n• Best practices for human-AI collaboration\n\nWhat's your biggest challenge with content creation? 👇",
      status: "published",
      linkedin_post_urn: "urn:li:share:1234567890",
      published_at: addDays(now, -5),
      created_at: addDays(now, -7),
      updated_at: addDays(now, -5),
      retry_count: 0,
    },
    {
      id: createId(),
      user_id: userId,
      title: "Building in Public: Week 4",
      content:
        "Week 4 update on building Linkie Claw! 🦀\n\nThis week we added:\n✅ Multi-user support\n✅ LinkedIn OAuth integration\n✅ Enhanced scheduler with retry logic\n\nNext up: Analytics dashboard 📊",
      status: "scheduled",
      scheduled_at: addDays(now, 2),
      created_at: addDays(now, -1),
      updated_at: addDays(now, -1),
      retry_count: 0,
    },
    {
      id: createId(),
      user_id: userId,
      title: "Draft: LinkedIn Algorithm Insights",
      content:
        "Working on a deep dive into the LinkedIn algorithm...\n\nKey findings so far:\n- Post timing matters less than engagement velocity\n- Comments > Likes for reach\n- Video performs 3x better than text\n\nMore to come!",
      status: "draft",
      created_at: addDays(now, -2),
      updated_at: addDays(now, -2),
      retry_count: 0,
    },
    {
      id: createId(),
      user_id: userId,
      title: "Failed Post Test",
      content: "This is a test post that failed to publish.",
      status: "failed",
      error_message: "LinkedIn API error: Invalid access token",
      created_at: addDays(now, -3),
      updated_at: addDays(now, -3),
      retry_count: 3,
    },
  ]);
  console.log("✅ Created sample posts");

  // Create sample generation
  await db.insert(generations).values({
    id: createId(),
    user_id: userId,
    idea: "AI-powered content studio for LinkedIn",
    text_variations_json: JSON.stringify([
      {
        id: "var-1",
        title: "5 Ways AI Can Supercharge Your LinkedIn Content",
        content: "AI is revolutionizing how we create content...",
        tone: "professional",
      },
      {
        id: "var-2",
        title: "How I Use AI to Create Better LinkedIn Posts",
        content: "I've been experimenting with AI tools for content creation...",
        tone: "casual",
      },
    ]),
    images_json: JSON.stringify([
      {
        id: "img-1",
        url: "/images/generation-1-a.png",
        prompt: "Professional office setting with AI hologram",
      },
      {
        id: "img-2",
        url: "/images/generation-1-b.png",
        prompt: "Abstract digital network visualization",
      },
    ]),
    selected_text_id: "var-1",
    selected_image_id: "img-1",
    created_at: addDays(now, -1),
  });
  console.log("✅ Created sample generation");

  // Create user settings
  await db.insert(userSettings).values({
    id: createId(),
    user_id: userId,
    linkedin_profile_url: "https://www.linkedin.com/in/joseph-seager/",
    linkedin_person_urn: "urn:li:person:abc123",
    linkedin_connected: true,
    linkedin_oauth_status: "connected",
    created_at: now,
    updated_at: now,
  });
  console.log("✅ Created user settings");

  console.log("\n🎉 Database seeded successfully!");
  console.log("Test user email: seagerjoe@gmail.com");
  process.exit(0);
}

seed().catch((error) => {
  console.error("❌ Seeding failed:", error);
  process.exit(1);
});
