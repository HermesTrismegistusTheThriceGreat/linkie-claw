"use client";

import { VariationCard } from "./variation-card";
import type { TextVariation } from "@/types";

interface VariationsCarouselProps {
  variations: TextVariation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function VariationsCarousel({
  variations,
  selectedId,
  onSelect,
}: VariationsCarouselProps) {
  return (
    <div className="space-y-4" data-testid="writer-variations-section">
      <h3 className="text-[#333333] text-xl font-bold flex items-center gap-2">
        <span className="material-symbols-outlined text-[#ee5b2b]">
          dynamic_feed
        </span>
        AI-Generated Variations
      </h3>
      <div className="flex overflow-x-auto gap-4 pb-4 snap-x">
        {variations.map((variation) => (
          <VariationCard
            key={variation.id}
            variation={variation}
            isSelected={selectedId === variation.id}
            onSelect={() => onSelect(variation.id)}
          />
        ))}
      </div>
    </div>
  );
}
