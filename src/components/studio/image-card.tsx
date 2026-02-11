"use client";

import { cn } from "@/lib/utils";
import type { GeneratedImage } from "@/types";

interface ImageCardProps {
  image: GeneratedImage;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export function ImageCard({ image, isSelected, onSelect }: ImageCardProps) {
  return (
    <div
      data-testid={`writer-image-${image.id}`}
      className={cn(
        "relative group aspect-square rounded-lg overflow-hidden cursor-pointer shadow-sm transition-all",
        isSelected
          ? "border-2 border-[#ee5b2b]"
          : "border border-gray-100 hover:shadow-md"
      )}
      onClick={() => onSelect(image.id)}
    >
      <img
        src={image.url}
        alt={image.prompt}
        className="w-full h-full object-cover"
      />

      {isSelected ? (
        <div className="absolute inset-0 bg-[#ee5b2b]/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-[#ee5b2b] text-4xl">
            check_circle
          </span>
        </div>
      ) : (
        <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="material-symbols-outlined text-white text-4xl drop-shadow">
            add
          </span>
        </div>
      )}
    </div>
  );
}
