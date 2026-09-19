import { cn } from "@/lib/utils";

export function Logo({
  className,
  textClassName,
  showName = true,
}: {
  className?: string;
  textClassName?: string;
  showName?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 text-base font-bold text-white">
        T
      </span>
      {showName && (
        <span
          className={cn(
            "text-lg font-semibold tracking-tight text-foreground",
            textClassName
          )}
        >
          Team<span className="text-blue-600">Flow</span>
        </span>
      )}
    </span>
  );
}