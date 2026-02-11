"use client";

import { ImageCard } from "./image-card";
import type { GeneratedImage } from "@/types";

interface ImageGridProps {
  images: GeneratedImage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ImageGrid({ images, selectedId, onSelect }: ImageGridProps) {
  return (
    <div className="space-y-4" data-testid="writer-images-section">
      <h3 className="text-[#333333] text-xl font-bold flex items-center gap-2">
        <span className="material-symbols-outlined text-[#ee5b2b]">palette</span>
        Generated Visuals
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {images.map((image) => (
          <ImageCard
            key={image.id}
            image={image}
            isSelected={image.id === selectedId}
            onSelect={() => onSelect(image.id)}
          />
        ))}
      </div>
    </div>
  );
}
