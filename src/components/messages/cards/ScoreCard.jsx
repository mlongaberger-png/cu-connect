import React from "react";

/**
 * ScoreCard — renders a Score Bot message as a structured card with a
 * colored win/loss accent instead of a plain gray bubble.
 */
export default function ScoreCard({ message }) {
  const content = message?.content_text ?? "";
  const isWin = content.includes("Won");
  const isLoss = content.includes("Lost");

  const borderColor = isWin
    ? "border-green-500"
    : isLoss
      ? "border-red-500"
      : "border-border";

  const badge = isWin ? (
    <span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
      WIN
    </span>
  ) : isLoss ? (
    <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
      LOSS
    </span>
  ) : null;

  return (
    <div className={`bg-muted rounded-lg p-3 my-1 border-l-4 ${borderColor} max-w-[85%]`}>
      {badge && <div className="mb-1.5">{badge}</div>}
      <p className="text-sm font-semibold text-foreground leading-relaxed">{content}</p>
      <p className="text-[10px] text-muted-foreground mt-1.5">Score Bot</p>
    </div>
  );
}