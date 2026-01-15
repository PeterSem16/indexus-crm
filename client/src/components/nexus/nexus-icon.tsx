import { cn } from "@/lib/utils";

interface NexusIconProps {
  className?: string;
  animate?: boolean;
}

export function NexusIcon({ className, animate = false }: NexusIconProps) {
  return (
    <div className={cn("relative", className)}>
      {animate && (
        <>
          <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse" />
        </>
      )}
      <svg
        viewBox="0 0 32 32"
        fill="none"
        className={cn(
          "relative z-10 w-full h-full",
          animate && "animate-pulse"
        )}
      >
        <circle
          cx="16"
          cy="16"
          r="14"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-primary"
        />
        <circle
          cx="16"
          cy="16"
          r="10"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="4 2"
          className="text-primary/60"
        />
        <circle
          cx="16"
          cy="16"
          r="6"
          fill="currentColor"
          className="text-primary"
        />
        <path
          d="M16 6V10M16 22V26M6 16H10M22 16H26"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="text-primary"
        />
        <path
          d="M9 9L11.5 11.5M20.5 20.5L23 23M9 23L11.5 20.5M20.5 11.5L23 9"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          className="text-primary/60"
        />
      </svg>
    </div>
  );
}
