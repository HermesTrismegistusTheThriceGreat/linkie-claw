"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AuroraBackground } from "@/components/layout/aurora-background";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/studio/header";
import { IdeaInput } from "@/components/studio/idea-input";
import { VariationsCarousel } from "@/components/studio/variations-carousel";
import { ImageGrid } from "@/components/studio/image-grid";
import { LinkedInPreview } from "@/components/studio/linkedin-preview";
import { ScheduleButton } from "@/components/studio/schedule-button";
import { ScheduleModal } from "@/components/studio/schedule-modal";
import { createGenerationSession } from "@/lib/queries/generations";
import type { TextVariation, GeneratedImage } from "@/types";

export default function CreatePage() {
  const [idea, setIdea] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [textVariations, setTextVariations] = useState<TextVariation[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleGenerate = async () => {
    if (!idea.trim()) return;

    setIsGenerating(true);
    try {
      const session = await createGenerationSession(idea);
      setTextVariations(session.textVariations);
      setImages(session.images);
      setSelectedTextId(null);
      setSelectedImageId(null);
    } catch (error) {
      console.error("Generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTextSelect = (id: string) => {
    setSelectedTextId(id);
  };

  const handleImageSelect = (id: string) => {
    setSelectedImageId(id);
  };

  const handleSchedule = async (scheduledAt: Date) => {
    const content = selectedText?.content;
    if (!content) return;

    // Step 1: Create post as draft
    const createResponse = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: idea.trim().slice(0, 200),
        content,
        imageUrl: selectedImage?.url,
        status: "draft",
      }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.json();
      toast.error("Failed to create post", {
        description: error.error || "Could not save post",
      });
      throw new Error(error.error || "Failed to create post");
    }

    const post = await createResponse.json();

    // Step 2: Schedule the draft via the schedule endpoint
    const scheduleResponse = await fetch(`/api/posts/${post.id}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduledAt: scheduledAt.toISOString(),
      }),
    });

    if (!scheduleResponse.ok) {
      const error = await scheduleResponse.json();
      toast.error("Scheduling failed", {
        description: error.error || "Post was saved as draft but scheduling failed",
      });
      throw new Error(error.error || "Failed to schedule post");
    }

    toast.success("Post scheduled!", {
      description: `Scheduled for ${scheduledAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at ${scheduledAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`,
    });

    // Reset page state
    setIdea("");
    setTextVariations([]);
    setImages([]);
    setSelectedTextId(null);
    setSelectedImageId(null);
    setIsModalOpen(false);
  };

  const selectedText = textVariations.find((v) => v.id === selectedTextId);
  const selectedImage = images.find((img) => img.id === selectedImageId);

  return (
    <AuroraBackground>
      <div className="flex min-h-screen" data-testid="page-create">
        <Sidebar />
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto">
            <div className="flex flex-col lg:flex-row gap-8 items-start">
              <div className="flex-1 space-y-8 w-full">
                <Header />

                <IdeaInput
                  idea={idea}
                  onIdeaChange={setIdea}
                  onGenerate={handleGenerate}
                  isGenerating={isGenerating}
                />

                {textVariations.length > 0 && (
                  <VariationsCarousel
                    variations={textVariations}
                    selectedId={selectedTextId}
                    onSelect={handleTextSelect}
                  />
                )}

                {images.length > 0 && (
                  <ImageGrid
                    images={images}
                    selectedId={selectedImageId}
                    onSelect={handleImageSelect}
                  />
                )}
              </div>

              <div className="w-full lg:w-[420px] lg:sticky lg:top-8 space-y-6">
                <LinkedInPreview
                  content={selectedText?.content || null}
                  imageUrl={selectedImage?.url || null}
                />

                <ScheduleButton
                  onClick={() => setIsModalOpen(true)}
                  disabled={!selectedTextId}
                />
              </div>
            </div>
          </div>
        </main>
      </div>

      <ScheduleModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSchedule={handleSchedule}
        selectedContent={selectedText?.content || null}
        selectedImageUrl={selectedImage?.url || null}
      />
    </AuroraBackground>
  );
}
