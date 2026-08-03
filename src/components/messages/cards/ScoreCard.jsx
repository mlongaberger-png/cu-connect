import React from "react";
import { Trophy, Calendar, Medal } from "lucide-react";

/**
 * Best-effort fallback parser for older Score Bot messages that were created
 * before structured `metadata` was attached to the Message record. Content
 * looks like:
 *   "🏆 Eagles Won 21–14 vs Hawks!\nSport: Football · Date: 2026-08-01 · Final Score: 21–14 · Opponent: Hawks"
 */
function parseFromContentText(content) {
  const parsed = {};
  const sportMatch = content.match(/Sport:\s*([^·\n]+)/);
  const dateMatch = content.match(/Date:\s*([^·\n]+)/);
  const scoreMatch = content.match(/Final Score:\s*([^·\n]+)/);
  const opponentMatch = content.match(/Opponent:\s*([^·\n]+)/);
  if (sportMatch) parsed.sport_name = sportMatch[1].trim();
  if (dateMatch) parsed.date = dateMatch[1].trim();
  if (opponentMatch) parsed.opponent = opponentMatch[1].trim();
  if (scoreMatch) {
    const [our_score, opponent_score] = scoreMatch[1].trim().split(/[–-]/);
    if (our_score) parsed.our_score = our_score.trim();
    if (opponent_score) parsed.opponent_score = opponent_score.trim();
  }
  return parsed;
}

/**
 * ScoreCard — renders a Score Bot message as a structured card with a
 * colored win/loss accent, a WIN/LOSS badge, and labeled fields for
 * opponent, sport, date and final score instead of the raw content string.
 */
export default function ScoreCard({ message }) {
  const content = message?.content_text ?? "";

  let meta = {};
  if (message?.metadata) {
    try {
      meta = JSON.parse(message.metadata) || {};
    } catch {
      meta = {};
    }
  }
  // Fall back to parsing the text body for messages created before
  // structured metadata was added to the backend.
  const fallback = Object.keys(meta).length === 0 ? parseFromContentText(content) : {};
  const data = { ...fallback, ...meta };

  const isWin = data.result ? data.result === "win" : content.includes("Won");
  const isLoss = data.result ? data.result === "loss" : content.includes("Lost");
  const isChampionshipWin = !!data.is_championship_win;

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

  const hasScore = data.our_score && data.opponent_score;
  const headline = (() => {
    // Use the first line of content_text as the human-written headline
    // (e.g. "🏆 Eagles Won 21–14 vs Hawks!") since it already reads well;
    // structured fields below add scannable detail underneath it.
    const firstLine = content.split("\n")[0];
    return firstLine || content;
  })();

  const hasStructuredFields = data.opponent || data.date || data.sport_name || hasScore;

  return (
    <div className={`bg-muted rounded-lg p-3 my-1 border-l-4 ${borderColor} max-w-[85%]`}>
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        {badge}
        {isChampionshipWin && (
          <span className="flex items-center gap-1 bg-amber-500/20 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
            <Trophy className="w-3 h-3" /> CHAMPIONSHIP
          </span>
        )}
      </div>

      <p className="text-sm font-semibold text-foreground leading-relaxed">{headline}</p>

      {hasStructuredFields ? (
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {data.opponent && (
            <div className="flex items-center gap-1">
              <span className="font-medium text-foreground/80">Opponent:</span> {data.opponent}
            </div>
          )}
          {hasScore && (
            <div className="flex items-center gap-1">
              <Medal className="w-3 h-3" />
              <span className="font-medium text-foreground/80">Score:</span> {data.our_score}–{data.opponent_score}
            </div>
          )}
          {data.sport_name && (
            <div className="flex items-center gap-1">
              <span className="font-medium text-foreground/80">Sport:</span> {data.sport_name}
            </div>
          )}
          {data.date && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {data.date}
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mt-1">{content.split("\n").slice(1).join(" ")}</p>
      )}

      <p className="text-[10px] text-muted-foreground mt-1.5">Score Bot</p>
    </div>
  );
}
