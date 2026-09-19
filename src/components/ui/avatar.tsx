import * as React from "react";
import { cn } from "@/lib/utils";
import { initials, avatarColor } from "@/lib/utils";

export function Avatar({
  name,
  src,
  className,
}: {
  name?: string | null;
  src?: string | null;
  className?: string;
}) {
  const label = name ?? "?";
  return (
    <span
      className={cn(
        "inline-flex h-8 w-8 shrink-0 select-none items-center justify-center overflow-hidden rounded-full text-xs font-semibold text-white",
        avatarColor(label),
        className
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label} className="h-full w-full object-cover" />
      ) : (
        initials(label)
      )}
    </span>
  );
}