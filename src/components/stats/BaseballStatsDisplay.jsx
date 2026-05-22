import React from "react";

const StatCell = ({ label, value }) => (
  <div className="flex flex-col items-center">
    <span className="text-[10px] text-muted-foreground uppercase tracking-wider leading-tight">{label}</span>
    <span className="text-sm font-bold text-foreground mt-0.5">{value ?? "—"}</span>
  </div>
);

const StatSection = ({ title, color, stats }) => (
  <div className="rounded-xl border border-border bg-surface p-3 space-y-2">
    <p className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{title}</p>
    <div className="grid grid-cols-5 gap-2">
      {stats.map(s => <StatCell key={s.label} label={s.label} value={s.value} />)}
    </div>
  </div>
);

export default function BaseballStatsDisplay({ stats = [] }) {
  if (!stats.length) return null;

  const hitting = stats.find(s => s.stat_type === "hitting");
  const pitching = stats.find(s => s.stat_type === "pitching");
  const fielding = stats.find(s => s.stat_type === "fielding");

  const seasonLabel = stats[0]?.season_label;

  return (
    <div className="space-y-3">
      {seasonLabel && (
        <p className="text-xs text-muted-foreground font-medium">{seasonLabel}</p>
      )}
      {hitting && (
        <StatSection
          title="Hitting"
          color="text-yellow-400"
          stats={[
            { label: "AVG", value: hitting.hitting_avg },
            { label: "AB", value: hitting.hitting_ab },
            { label: "H", value: hitting.hitting_h },
            { label: "R", value: hitting.hitting_r },
            { label: "RBI", value: hitting.hitting_rbi },
            { label: "HR", value: hitting.hitting_hr },
            { label: "BB", value: hitting.hitting_bb },
            { label: "K", value: hitting.hitting_k },
            { label: "OBP", value: hitting.hitting_obp },
            { label: "SLG", value: hitting.hitting_slg },
          ]}
        />
      )}
      {pitching && (
        <StatSection
          title="Pitching"
          color="text-blue-400"
          stats={[
            { label: "ERA", value: pitching.pitching_era },
            { label: "IP", value: pitching.pitching_ip },
            { label: "W", value: pitching.pitching_w },
            { label: "L", value: pitching.pitching_l },
            { label: "SO", value: pitching.pitching_so },
            { label: "BB", value: pitching.pitching_bb },
            { label: "WHIP", value: pitching.pitching_whip },
          ]}
        />
      )}
      {fielding && (
        <StatSection
          title="Fielding"
          color="text-green-400"
          stats={[
            { label: "PO", value: fielding.fielding_po },
            { label: "A", value: fielding.fielding_a },
            { label: "E", value: fielding.fielding_e },
            { label: "FPCT", value: fielding.fielding_fpct },
          ]}
        />
      )}
    </div>
  );
}