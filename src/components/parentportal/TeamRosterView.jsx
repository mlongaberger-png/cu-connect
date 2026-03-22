import React from "react";
import { motion } from "framer-motion";
import { Users, Phone, Mail, Shield } from "lucide-react";
import RosterPDFButton from "@/components/roster/RosterPDFButton";

export default function TeamRosterView({ team, players = [] }) {
  if (!team?.roster_published) return null;

  const sorted = [...players].sort((a, b) => {
    const numA = parseInt(a.jersey_number) || 999;
    const numB = parseInt(b.jersey_number) || 999;
    if (numA !== numB) return numA - numB;
    return a.last_name.localeCompare(b.last_name);
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl border border-border overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{team.name} — Roster</h3>
            <p className="text-xs text-muted-foreground">{sorted.length} player{sorted.length !== 1 ? "s" : ""}{team.sport_name ? ` · ${team.sport_name}` : ""}</p>
          </div>
        </div>
        <RosterPDFButton team={team} players={sorted} label="PDF" className="text-xs" />
      </div>

      {/* Coach info */}
      {(team.head_coach || team.coach_email) && (
        <div className="px-5 py-3 bg-primary/5 border-b border-border flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span className="font-medium text-foreground">{team.head_coach || "Coach"}</span>
            <span className="text-xs text-muted-foreground">Head Coach</span>
          </div>
          {team.coach_email && (
            <a href={`mailto:${team.coach_email}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
              <Mail className="w-3.5 h-3.5" /> {team.coach_email}
            </a>
          )}
          {team.coach_phone && (
            <a href={`tel:${team.coach_phone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
              <Phone className="w-3.5 h-3.5" /> {team.coach_phone}
            </a>
          )}
        </div>
      )}

      {/* Player list */}
      {sorted.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground text-sm">No players on this roster yet.</div>
      ) : (
        <div className="divide-y divide-border">
          {sorted.map((player, idx) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="px-5 py-3 flex items-center gap-4"
            >
              {/* Jersey number */}
              <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-black text-primary">{player.jersey_number || "—"}</span>
              </div>

              {/* Name + Position */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {player.first_name} {player.last_name}
                </p>
                {player.position && (
                  <p className="text-xs text-muted-foreground">{player.position}</p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}