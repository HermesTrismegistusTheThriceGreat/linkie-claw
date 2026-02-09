/**
 * Database seed script for development.
 * Run with: npm run db:seed
 */

import { db } from "./index";
import { posts, generations } from "./schema";
import { createId } from "@paralleldrive/cuid2";
import {
  addDays,
  subDays,
  setHours,
  setMinutes,
  startOfDay,
} from "date-fns";

// Helper to set time on a date
function setTime(date: Date, hours: number, minutes: number): Date {
  return setMinutes(setHours(date, hours), minutes);
}

async function seed() {
  console.log("Seeding database...");

  // Clear existing data
  console.log("Clearing existing data...");
  await db.delete(posts);
  await db.delete(generations);

  const now = new Date();
  const today = startOfDay(now);

  // Sample posts with various statuses and dates
  const samplePosts = [
    // Draft posts
    {
      id: createId(),
      title: "5 Leadership Lessons from Remote Work",
      content: `The past few years have taught us more about leadership than any MBA program ever could.

Here are 5 lessons I've learned leading remote teams:

1. Trust is everything. Micromanagement kills productivity and morale.
2. Over-communicate, then communicate some more. Silence breeds anxiety.
3. Results matter more than hours logged. Focus on outcomes.
4. Video calls aren't always necessary. Sometimes a quick message works better.
5. Celebrate wins publicly, give feedback privately.

What leadership lessons have you learned from remote work?

#Leadership #RemoteWork #Management`,
      status: "draft" as const,
      scheduled_at: null,
      created_at: subDays(now, 2),
      updated_at: subDays(now, 1),
    },
    {
      id: createId(),
      title: "The Art of Saying No",
      content: `Early in my career, I said yes to everything.

Every meeting. Every project. Every coffee chat.

I was exhausted, unfocused, and producing mediocre work.

Then I learned the power of "no."

Saying no isn't about being difficult. It's about:
- Protecting your time for what truly matters
- Setting healthy boundaries
- Delivering excellence on fewer things

The best opportunities often come when you have space for them.

What have you said "no" to recently that created space for something better?

#CareerAdvice #Productivity #WorkLifeBalance`,
      status: "draft" as const,
      scheduled_at: null,
      created_at: subDays(now, 5),
      updated_at: subDays(now, 3),
    },

    // Scheduled posts (future)
    {
      id: createId(),
      title: "Why I Stopped Checking Email First Thing",
      content: `I used to wake up and immediately check my email.

Within minutes, I was reactive. Stressed. Already behind.

Now I start my day differently:
- 30 minutes of reading or learning
- Exercise
- Deep work on my most important task
- THEN email

The result? More focus, better decisions, and surprisingly... fewer fires to put out.

Your morning routine sets the tone for your entire day.

How do you start yours?

#Productivity #MorningRoutine #DeepWork`,
      status: "scheduled" as const,
      scheduled_at: setTime(addDays(today, 1), 9, 0),
      created_at: subDays(now, 1),
      updated_at: now,
    },
    {
      id: createId(),
      title: "The Compound Effect of Learning",
      content: `1 hour of learning per day = 365 hours per year.

That's over 9 full work weeks dedicated to growth.

In 5 years, that's 1,825 hours of deliberate learning.

The compound effect is real:
- Year 1: You're slightly ahead
- Year 3: You're noticeably different
- Year 5: You're in a different league

The best investment you can make is in yourself.

What are you learning right now?

#ContinuousLearning #PersonalDevelopment #Growth`,
      status: "scheduled" as const,
      scheduled_at: setTime(addDays(today, 3), 10, 30),
      created_at: subDays(now, 2),
      updated_at: subDays(now, 1),
    },
    {
      id: createId(),
      title: "Feedback is a Gift",
      content: `The best feedback I ever received hurt to hear.

A mentor told me: "You're smart, but you talk too much in meetings. You're not leaving room for others to contribute."

Ouch.

But that feedback changed my career. I learned to:
- Listen more than I speak
- Ask questions instead of giving answers
- Create space for quieter voices

Now I actively seek critical feedback.

The truth might sting, but staying blind to your weaknesses hurts more.

What's the best feedback you've ever received?

#Feedback #Growth #Leadership`,
      status: "scheduled" as const,
      scheduled_at: setTime(addDays(today, 5), 8, 0),
      created_at: subDays(now, 3),
      updated_at: subDays(now, 2),
    },
    {
      id: createId(),
      title: "Building in Public: Month 1 Update",
      content: `30 days ago, I started building Sunday - a LinkedIn scheduling tool.

Here's what happened:

The good:
- Shipped the MVP
- Got first 50 beta users
- Learned more about Next.js than 3 months of tutorials

The challenging:
- OAuth integration was harder than expected
- Scope creep is real (and tempting)
- Marketing yourself is uncomfortable

Key insight: Perfect is the enemy of done. Ship early, iterate fast.

Next month's goal: 200 users and a paid tier.

Follow along for more updates!

#BuildInPublic #Startup #IndieHacker`,
      status: "scheduled" as const,
      scheduled_at: setTime(addDays(today, 7), 11, 0),
      created_at: now,
      updated_at: now,
    },

    // Published posts (past)
    {
      id: createId(),
      title: "My Tech Stack for 2024",
      content: `After building 10+ projects last year, here's my go-to stack:

Frontend:
- Next.js 14 (App Router is a game changer)
- TypeScript (non-negotiable)
- Tailwind CSS (productivity boost)

Backend:
- Drizzle ORM (type safety matters)
- SQLite for simple projects
- Postgres for complex ones

Deployment:
- Vercel for frontend
- Railway for backend
- Cloudflare for everything else

The best stack is the one you know well.

What's your go-to stack?

#WebDevelopment #TechStack #Programming`,
      status: "published" as const,
      scheduled_at: setTime(subDays(today, 3), 9, 0),
      published_at: setTime(subDays(today, 3), 9, 0),
      linkedin_post_urn: "urn:li:share:7123456789012345678",
      created_at: subDays(now, 5),
      updated_at: subDays(now, 3),
    },
    {
      id: createId(),
      title: "The 80/20 Rule Changed My Life",
      content: `20% of your efforts produce 80% of your results.

Once I truly understood this, everything changed.

I audited my work and found:
- 3 clients brought 80% of revenue
- 2 tasks drove 80% of my impact
- 1 skill was responsible for 80% of my opportunities

Now I ruthlessly prioritize the vital few over the trivial many.

Stop doing more. Start doing what matters.

What's your 20% that drives 80% of your success?

#Productivity #Pareto #Focus`,
      status: "published" as const,
      scheduled_at: setTime(subDays(today, 7), 10, 0),
      published_at: setTime(subDays(today, 7), 10, 0),
      linkedin_post_urn: "urn:li:share:7123456789012345679",
      created_at: subDays(now, 10),
      updated_at: subDays(now, 7),
    },

    // Failed post
    {
      id: createId(),
      title: "Test Post That Failed",
      content: `This is a test post that failed to publish due to an API error.

The content itself is fine, but the LinkedIn API returned an error during publishing.

This demonstrates how failed posts are handled in the system.`,
      status: "failed" as const,
      scheduled_at: setTime(subDays(today, 1), 14, 0),
      error_message: "LinkedIn API Error: Rate limit exceeded. Please try again later.",
      created_at: subDays(now, 2),
      updated_at: subDays(now, 1),
    },
  ];

  console.log(`Inserting ${samplePosts.length} posts...`);
  for (const post of samplePosts) {
    await db.insert(posts).values(post);
  }

  // Sample generations
  const sampleGenerations = [
    {
      id: createId(),
      idea: "Write about the importance of taking breaks during work",
      text_variations_json: JSON.stringify([
        "Taking regular breaks isn't lazy - it's strategic. Your brain needs time to process and consolidate information...",
        "I used to work 10-hour days without breaks. Then I burned out. Here's what I learned...",
        "The science is clear: breaks improve productivity. Yet most of us still feel guilty taking them...",
        "What if I told you that working LESS could help you achieve MORE?",
        "Stop glorifying the hustle. Start prioritizing recovery.",
        "My productivity hack that actually works? It's not a tool or app. It's scheduled breaks.",
      ]),
      images_json: JSON.stringify([
        "https://placehold.co/800x800/EEE/31343C?text=Break+Time",
        "https://placehold.co/800x800/EEE/31343C?text=Productivity",
        "https://placehold.co/800x800/EEE/31343C?text=Work+Smart",
        "https://placehold.co/800x800/EEE/31343C?text=Rest+%26+Recover",
        "https://placehold.co/800x800/EEE/31343C?text=Focus",
        "https://placehold.co/800x800/EEE/31343C?text=Balance",
      ]),
      selected_text_id: "1",
      selected_image_id: "0",
      created_at: subDays(now, 4),
    },
    {
      id: createId(),
      idea: "Share tips for effective one-on-one meetings",
      text_variations_json: JSON.stringify([
        "The best managers I've worked with all have one thing in common: they take 1:1s seriously...",
        "Your 1:1 meetings are either building trust or destroying it. There's no neutral ground...",
        "I've had hundreds of 1:1 meetings. Here's the framework that actually works...",
        "Stop asking 'How's it going?' in your 1:1s. Ask these questions instead...",
        "The 1:1 meeting is the most underutilized tool in management.",
        "Want to retain your best people? Start with better 1:1 conversations.",
      ]),
      images_json: JSON.stringify([
        "https://placehold.co/800x800/EEE/31343C?text=One+on+One",
        "https://placehold.co/800x800/EEE/31343C?text=Management",
        "https://placehold.co/800x800/EEE/31343C?text=Leadership",
        "https://placehold.co/800x800/EEE/31343C?text=Conversations",
        "https://placehold.co/800x800/EEE/31343C?text=Team",
        "https://placehold.co/800x800/EEE/31343C?text=Growth",
      ]),
      selected_text_id: null,
      selected_image_id: null,
      created_at: subDays(now, 1),
    },
  ];

  console.log(`Inserting ${sampleGenerations.length} generations...`);
  for (const generation of sampleGenerations) {
    await db.insert(generations).values(generation);
  }

  console.log("Seeding complete!");
  console.log(`Created ${samplePosts.length} posts and ${sampleGenerations.length} generations.`);

  // Verify by counting
  const postCount = await db.select().from(posts);
  const genCount = await db.select().from(generations);
  console.log(`Verification: ${postCount.length} posts, ${genCount.length} generations in database.`);
}

seed()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
