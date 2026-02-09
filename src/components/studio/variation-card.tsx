"use client";

import { cn } from "@/lib/utils";
import type { TextVariation } from "@/types";

interface VariationCardProps {
  variation: TextVariation;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export function VariationCard({
  variation,
  isSelected,
  onSelect,
}: VariationCardProps) {
  return (
    <div
      className={cn(
        "min-w-[280px] p-5 rounded-lg flex flex-col gap-3 snap-start cursor-pointer",
        "bg-white transition-all",
        isSelected
          ? "border-2 border-[#ee5b2b] shadow-[0_0_15px_rgba(238,95,43,0.15)]"
          : "border border-[#E6E6FA] hover:bg-gray-50"
      )}
      onClick={() => onSelect(variation.id)}
    >
      <div className="flex justify-between items-start">
        <span
          className={cn(
            "text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider",
            isSelected
              ? "bg-[#E6E6FA] text-purple-600"
              : "bg-gray-100 text-gray-600"
          )}
        >
          {variation.style}
        </span>
        {isSelected && (
          <span className="material-symbols-outlined text-[#ee5b2b] text-sm">
            check_circle
          </span>
        )}
      </div>
      <p
        className={cn(
          "text-sm leading-relaxed",
          isSelected ? "text-[#333333] italic" : "text-[#333333]/80"
        )}
      >
        {variation.content.length > 120
          ? `${variation.content.slice(0, 120)}...`
          : variation.content}
      </p>
    </div>
  );
}
