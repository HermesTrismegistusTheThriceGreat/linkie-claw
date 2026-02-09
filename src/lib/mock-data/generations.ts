import type { TextVariation, GeneratedImage, GenerationSession } from "@/types/generation";

export const mockTextVariations: TextVariation[] = [
  {
    id: "var-1",
    style: "Storytelling",
    content:
      "Last Tuesday, I made a decision that changed everything.\n\nI was sitting in yet another pointless meeting when it hit me—I'd been optimizing for the wrong metrics my entire career.\n\nHere's what nobody tells you about success...",
  },
  {
    id: "var-2",
    style: "Professional",
    content:
      "After analyzing Q3 data across 500+ companies, one trend is clear:\n\nThe organizations that prioritize async communication see 34% higher employee satisfaction and 27% better retention rates.\n\nHere's how to implement this in your team...",
  },
  {
    id: "var-3",
    style: "Short & Punchy",
    content:
      "Hot take:\n\nMeetings are where ideas go to die.\n\nHere's what to do instead →\n\n• Async updates\n• Recorded looms\n• Written memos\n\nYour calendar will thank you.",
  },
  {
    id: "var-4",
    style: "Data-Driven",
    content:
      "87% of remote teams struggle with async communication.\n\nBut the top 13% share one habit:\n\nThey document everything.\n\n📊 Meeting notes → Shared docs\n📊 Decisions → Slack threads\n📊 Context → Recorded videos\n\nThe data doesn't lie.",
  },
  {
    id: "var-5",
    style: "Conversational",
    content:
      "Can we talk about something that's been bugging me?\n\nWhy do we still default to meetings for everything?\n\nI asked my team to try something different for 30 days. The results surprised all of us.\n\nHere's what we learned...",
  },
  {
    id: "var-6",
    style: "Provocative",
    content:
      "Unpopular opinion:\n\nYour morning routine doesn't matter.\n\nWhat matters is what you're willing to give up.\n\nI stopped optimizing my mornings and started eliminating my afternoons.\n\nProductivity doubled.\n\nHere's the uncomfortable truth...",
  },
];

export const mockImages: GeneratedImage[] = [
  {
    id: "img-1",
    url: "https://picsum.photos/seed/gen1/800/800",
    prompt: "Professional workspace with warm lighting and minimal design",
  },
  {
    id: "img-2",
    url: "https://picsum.photos/seed/gen2/800/800",
    prompt: "Abstract gradient mesh with coral and purple tones",
  },
  {
    id: "img-3",
    url: "https://picsum.photos/seed/gen3/800/800",
    prompt: "Modern office with plants and natural light",
  },
  {
    id: "img-4",
    url: "https://picsum.photos/seed/gen4/800/800",
    prompt: "Tech-inspired geometric patterns in warm colors",
  },
  {
    id: "img-5",
    url: "https://picsum.photos/seed/gen5/800/800",
    prompt: "Minimalist desk setup with coffee and notebook",
  },
  {
    id: "img-6",
    url: "https://picsum.photos/seed/gen6/800/800",
    prompt: "Creative workspace with mood lighting",
  },
];

export const mockGenerationSession: GenerationSession = {
  id: "session-1",
  idea: "How async communication transformed our remote team's productivity",
  textVariations: mockTextVariations,
  images: mockImages,
  selectedTextId: "var-1",
  selectedImageId: "img-2",
  createdAt: new Date(),
};
