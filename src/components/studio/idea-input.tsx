"use client";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface IdeaInputProps {
  idea: string;
  onIdeaChange: (value: string) => void;
  onGenerate: () => void;
  isGenerating?: boolean;
  className?: string;
}

export function IdeaInput({
  idea,
  onIdeaChange,
  onGenerate,
  isGenerating = false,
  className,
}: IdeaInputProps) {
  return (
    <div className={cn("white-card rounded-lg p-6 space-y-4", className)} data-testid="writer-idea-input">
      <div className="flex gap-4">
        <Avatar className="size-12 flex-shrink-0 border border-gray-100" />

        <Textarea
          value={idea}
          onChange={(e) => onIdeaChange(e.target.value)}
          placeholder="What's your idea? Describe your post prompt here..."
          data-testid="writer-input-idea"
          className="w-full bg-transparent border-none focus:ring-0 focus-visible:ring-0 text-xl text-[#333333] placeholder:text-gray-300 resize-none min-h-[120px] p-0"
        />
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-50">
        <div className="flex items-center gap-2 text-gray-400">
          <button
            type="button"
            data-testid="writer-btn-ai-enhance"
            className="p-2 hover:text-[#ee5b2b] transition-colors"
            aria-label="AI enhance"
          >
            <span className="material-symbols-outlined">auto_awesome</span>
          </button>
          <button
            type="button"
            data-testid="writer-btn-add-image"
            className="p-2 hover:text-[#ee5b2b] transition-colors"
            aria-label="Add image"
          >
            <span className="material-symbols-outlined">image</span>
          </button>
          <button
            type="button"
            data-testid="writer-btn-voice-input"
            className="p-2 hover:text-[#ee5b2b] transition-colors"
            aria-label="Voice input"
          >
            <span className="material-symbols-outlined">mic</span>
          </button>
          <button
            type="button"
            data-testid="writer-btn-attach-file"
            className="p-2 hover:text-[#ee5b2b] transition-colors"
            aria-label="Attach file"
          >
            <span className="material-symbols-outlined">attach_file</span>
          </button>
        </div>

        <Button
          onClick={onGenerate}
          disabled={isGenerating || !idea.trim()}
          data-testid="writer-btn-generate"
          className="coral-gradient px-8 h-12 rounded-full text-white font-bold shadow-lg shadow-[#ee5b2b]/20 hover:scale-105 transition-all flex items-center gap-2 border-0"
        >
          <span>{isGenerating ? "Generating..." : "Generate Magic ✨"}</span>
        </Button>
      </div>
    </div>
  );
}
