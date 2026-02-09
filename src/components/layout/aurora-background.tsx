import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface AuroraBackgroundProps {
  children: ReactNode;
  className?: string;
}

export function AuroraBackground({
  children,
  className,
}: AuroraBackgroundProps) {
  return (
    <div className={cn("aurora-bg flex", className)}>
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}
