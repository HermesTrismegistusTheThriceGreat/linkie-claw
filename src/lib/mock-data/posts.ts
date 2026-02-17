import type { Post, Draft } from "@/types/post";

// Mock user ID for demo data
const MOCK_USER_ID = "mock-user-001";

// Helper to create relative dates from today
function daysFromNow(days: number, hour = 9, minute = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

export const mockPosts: Post[] = [
  {
    id: "post-1",
    userId: MOCK_USER_ID,
    title: "The 5-Step AI Framework",
    content:
      "Everyone's using AI wrong.\n\nHere's my 5-step framework for 10x productivity:\n\n1. Define the outcome first\n2. Give context, not commands\n3. Iterate, don't regenerate\n4. Build your prompt library\n5. Know when NOT to use AI\n\nThe last one is the most important.",
    imageUrl: "https://picsum.photos/seed/ai-framework/800/600",
    scheduledAt: daysFromNow(0, 9, 0), // Today at 9:00 AM
    status: "scheduled",
    retryCount: 0,
    createdAt: daysAgo(3),
    updatedAt: daysAgo(3),
  },
  {
    id: "post-2",
    userId: MOCK_USER_ID,
    title: "Weekly Newsletter Recap",
    content:
      "This week's top insights from my newsletter:\n\n📈 AI adoption in enterprise: +340% YoY\n🎯 Remote work preference: 78% of tech workers\n💡 Top skill for 2025: Prompt engineering\n\nSubscribe for weekly deep dives into tech leadership.\n\nLink in comments 👇",
    imageUrl: "https://picsum.photos/seed/newsletter/800/600",
    scheduledAt: daysFromNow(2, 11, 30), // Day after tomorrow at 11:30 AM
    status: "scheduled",
    retryCount: 0,
    createdAt: daysAgo(5),
    updatedAt: daysAgo(5),
  },
  {
    id: "post-3",
    userId: MOCK_USER_ID,
    title: "Case Study: Aurora UI",
    content:
      "How we redesigned our entire product in 6 weeks using Aurora UI principles:\n\n✨ Glassmorphism for depth\n🌈 Soft gradients for warmth\n📱 Mobile-first approach\n\nResult: 40% increase in user engagement.\n\nFull case study in the thread below 🧵",
    imageUrl: "https://picsum.photos/seed/aurora-ui/800/600",
    scheduledAt: daysFromNow(3, 14, 0), // 3 days from now at 2:00 PM
    status: "scheduled",
    retryCount: 0,
    createdAt: daysAgo(4),
    updatedAt: daysAgo(4),
  },
  {
    id: "post-4",
    userId: MOCK_USER_ID,
    title: "5 Leadership Lessons from My First Year as CTO",
    content:
      "When I stepped into the CTO role last January, I thought technical skills would be my biggest asset.\n\nI was wrong.\n\nHere are 5 lessons that transformed how I lead:\n\n1. Listen more than you speak\n2. Hire for culture, train for skills\n3. Your team's growth = your growth\n4. Transparency builds trust\n5. Celebrate small wins daily\n\nWhat's the best leadership advice you've received?",
    imageUrl: "https://picsum.photos/seed/leadership/800/600",
    scheduledAt: daysFromNow(5, 9, 0),
    status: "scheduled",
    retryCount: 0,
    createdAt: daysAgo(7),
    updatedAt: daysAgo(7),
  },
  {
    id: "post-5",
    userId: MOCK_USER_ID,
    title: "The productivity hack nobody talks about",
    content:
      "I deleted Slack from my phone 3 months ago.\n\nMy productivity increased by 40%.\n\nHere's what I learned about async communication:\n\n• Urgent ≠ Important\n• Deep work requires disconnection\n• Batching messages saves hours\n• Your best ideas come in silence\n\nThe irony? My team's collaboration actually improved.\n\nSometimes the best notification is no notification.",
    imageUrl: "https://picsum.photos/seed/productivity/800/600",
    scheduledAt: daysFromNow(7, 14, 0),
    status: "scheduled",
    retryCount: 0,
    createdAt: daysAgo(10),
    updatedAt: daysAgo(10),
  },
  {
    id: "post-6",
    userId: MOCK_USER_ID,
    title: "Building in public changed everything",
    content:
      "6 months ago I started building in public.\n\nHere's what happened:\n\n→ 0 to 15K followers\n→ 3 partnership offers\n→ A community I love\n\nThe secret? Consistency over perfection.\n\nEvery day, share something real.",
    imageUrl: "https://picsum.photos/seed/building-public/800/600",
    publishedAt: daysAgo(3),
    status: "published",
    retryCount: 0,
    createdAt: daysAgo(10),
    updatedAt: daysAgo(3),
  },
  {
    id: "post-7",
    userId: MOCK_USER_ID,
    title: "Hot take: Meetings are broken",
    content:
      "Hot take:\n\nMeetings are where ideas go to die.\n\nHere's what to do instead →\n\n1. Write a memo (forces clarity)\n2. Record a Loom (async review)\n3. Slack thread (documented decisions)\n4. 15-min standups (time-boxed)\n\nYour calendar will thank you.",
    imageUrl: "https://picsum.photos/seed/meetings/800/600",
    publishedAt: daysAgo(7),
    status: "published",
    retryCount: 0,
    createdAt: daysAgo(14),
    updatedAt: daysAgo(7),
  },
];

export const mockDrafts: Draft[] = [
  {
    id: "draft-1",
    userId: MOCK_USER_ID,
    title: "The Future of SaaS UI: Aurora & Glassmorphism",
    content:
      "The SaaS landscape is shifting.\n\nGone are the days of flat, sterile interfaces.\n\nWelcome to the era of:\n• Depth through glass effects\n• Warmth through gradients\n• Emotion through animation\n\nAurora UI isn't just a trend—it's the future.",
    imageUrl: "https://picsum.photos/seed/saas-ui/800/600",
    status: "draft",
    characterCount: 850,
    retryCount: 0,
    createdAt: new Date("2024-11-10"),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
  },
  {
    id: "draft-2",
    userId: MOCK_USER_ID,
    title: "Mastering Personal Branding on LinkedIn 2024",
    content:
      "Your personal brand is your most valuable asset.\n\nAfter growing to 50K followers, here's my playbook:\n\n1. Find your unique angle\n2. Post consistently (but quality > quantity)\n3. Engage authentically\n4. Share stories, not just tips\n5. Build in public\n\nYour brand is what people say when you're not in the room.",
    imageUrl: "https://picsum.photos/seed/personal-brand/800/600",
    status: "draft",
    characterCount: 1200,
    retryCount: 0,
    createdAt: new Date("2024-11-09"),
    updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
  },
  {
    id: "draft-3",
    userId: MOCK_USER_ID,
    title: "Why I Quit Big Tech for a Startup",
    content:
      "I left a $500K/year job at FAANG.\n\nPeople thought I was crazy.\n\nBut here's the truth:\n\n• Titles don't equal impact\n• Comfort zones kill growth\n• Life is too short for golden handcuffs\n\n6 months later? Best decision I ever made.",
    status: "draft",
    characterCount: 620,
    retryCount: 0,
    createdAt: new Date("2024-11-08"),
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
  },
  {
    id: "draft-4",
    userId: MOCK_USER_ID,
    title: "The Art of Saying No",
    content:
      "The most successful people I know have one thing in common:\n\nThey say 'no' more than they say 'yes'.\n\nEvery yes to something unimportant is a no to something that matters.\n\nProtect your time like it's your most valuable asset.\n\nBecause it is.",
    status: "draft",
    characterCount: 450,
    retryCount: 0,
    createdAt: new Date("2024-11-07"),
    updatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
  },
];
