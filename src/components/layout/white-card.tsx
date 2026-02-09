import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface WhiteCardProps {
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
  rounded?: "lg" | "xl" | "2xl" | "3xl";
}

const paddingVariants = {
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

const roundedVariants = {
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  "3xl": "rounded-3xl",
};

export function WhiteCard({
  children,
  className,
  padding = "md",
  rounded = "2xl",
}: WhiteCardProps) {
  return (
    <div
      className={cn(
        "bg-white border border-black/5 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.04)]",
        paddingVariants[padding],
        roundedVariants[rounded],
        className
      )}
    >
      {children}
    </div>
  );
}
