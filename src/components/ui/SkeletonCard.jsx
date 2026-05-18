import React from "react";
import { cn } from "@/lib/utils";

function Shimmer({ className }) {
  return (
    <div
      className={cn(
        "bg-muted/60 rounded-lg animate-pulse",
        className
      )}
    />
  );
}

export function SkeletonStatCard() {
  return (
    <div className="bg-card/80 rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Shimmer className="h-3.5 w-24" />
          <Shimmer className="h-8 w-16" />
        </div>
        <Shimmer className="w-12 h-12 rounded-xl" />
      </div>
    </div>
  );
}

export function SkeletonEventRow() {
  return (
    <div className="flex items-start gap-4 p-3 rounded-xl bg-surface">
      <div className="flex flex-col items-center min-w-[48px] gap-1">
        <Shimmer className="h-3 w-8" />
        <Shimmer className="h-7 w-10" />
      </div>
      <div className="flex-1 space-y-2">
        <Shimmer className="h-4 w-16 rounded-full" />
        <Shimmer className="h-4 w-40" />
        <Shimmer className="h-3 w-28" />
      </div>
    </div>
  );
}

export function SkeletonListItem() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-surface">
      <Shimmer className="w-9 h-9 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Shimmer className="h-4 w-32" />
        <Shimmer className="h-3 w-20" />
      </div>
      <Shimmer className="h-6 w-14 rounded-full" />
    </div>
  );
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="bg-card/80 rounded-2xl border border-border p-5 space-y-3">
      <Shimmer className="h-5 w-36" />
      {Array.from({ length: lines }).map((_, i) => (
        <Shimmer key={i} className={`h-3.5 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

export default Shimmer;