"use client";

import { cn } from "@/lib/utils";

interface ScheduleButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export function ScheduleButton({
  onClick,
  disabled = false,
  children = "Schedule Post",
  className,
}: ScheduleButtonProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "w-full h-14 rounded-full text-white font-black text-lg",
          "shadow-xl shadow-primary/20 transition-all transform",
          "coral-gradient flex items-center justify-center gap-3",
          "hover:scale-[1.02] active:scale-95",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        )}
      >
        <span className="material-symbols-outlined">rocket_launch</span>
        {children}
      </button>
    </div>
  );
}
