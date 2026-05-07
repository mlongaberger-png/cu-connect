import React from "react";
import { cn } from "@/lib/utils";

/**
 * Reusable player avatar — shows photo if available, otherwise initials.
 * size: "sm" (w-7 h-7), "md" (w-9 h-9 default), "lg" (w-10 h-10), "xl" (w-12 h-12)
 */
const SIZES = {
  sm:  "w-7 h-7 text-xs",
  md:  "w-9 h-9 text-xs",
  lg:  "w-10 h-10 text-sm",
  xl:  "w-12 h-12 text-lg",
};

export default function PlayerAvatar({ player, size = "md", className }) {
  const initials = `${player?.first_name?.[0] || ""}${player?.last_name?.[0] || ""}`.toUpperCase();
  const sizeClass = SIZES[size] || SIZES.md;

  return (
    <div className={cn("rounded-full overflow-hidden flex items-center justify-center shrink-0 bg-primary/20", sizeClass, className)}>
      {player?.photo_url
        ? <img src={player.photo_url} alt={player.first_name} className="w-full h-full object-cover object-top" />
        : <span className="font-bold text-primary">{initials}</span>
      }
    </div>
  );
}