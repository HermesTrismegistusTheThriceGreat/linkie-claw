import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
  rounded?: "lg" | "xl" | "2xl" | "3xl";
}

const paddingMap = {
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
} as const;

const roundedMap = {
  lg: "rounded-lg",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  "3xl": "rounded-3xl",
} as const;

export function GlassCard({
  children,
  className,
  padding = "md",
  rounded = "2xl",
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "glass-card",
        paddingMap[padding],
        roundedMap[rounded],
        "border border-white/40 shadow-sm",
        "transition-all duration-200",
        className
      )}
    >
      {children}
    </div>
  );
}
