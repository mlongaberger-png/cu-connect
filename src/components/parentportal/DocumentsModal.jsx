import React, { useState } from "react";
import { X, FileText } from "lucide-react";
import PlayerDocuments from "@/components/parentportal/PlayerDocuments";
import PlayerAvatar from "@/components/ui/PlayerAvatar";

export default function DocumentsModal({ players = [], teams = [], onClose }) {
  const [selectedPlayerId, setSelectedPlayerId] = useState(players[0]?.id || null);
  const selectedPlayer = players.find(p => p.id === selectedPlayerId) || players[0];

  if (!selectedPlayer) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]" onClick={onClose}>
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div
          className="relative w-full sm:max-w-lg bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          style={{ maxHeight: "calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 8rem)" }}
          onClick={e => e.stopPropagation()}
        >
          <div className="h-1.5 w-full bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
          <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm px-5 pt-5 pb-3 flex items-center justify-between border-b border-border">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <h2 className="font-black text-foreground text-lg">Documents & Forms</h2>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-surface flex items-center justify-center hover:bg-border transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <div className="p-5 flex-1 overflow-y-auto min-h-0">
            <p className="text-sm text-muted-foreground text-center py-8">No athletes linked to your account yet.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-lg bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 8rem)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Gold top bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

        {/* Header */}
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm px-5 pt-5 pb-3 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <h2 className="font-black text-foreground text-lg">Documents & Forms</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-surface flex items-center justify-center hover:bg-border transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Player selector (if multiple kids) */}
        {players.length > 1 && (
          <div className="px-5 pt-3 flex gap-2 overflow-x-auto">
            {players.map(p => {
              const isActive = p.id === selectedPlayerId;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlayerId(p.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border shrink-0 transition-colors ${
                    isActive ? "bg-primary/15 border-primary/40" : "bg-surface border-border hover:bg-surface-hover"
                  }`}
                >
                  <PlayerAvatar player={p} size="sm" />
                  <span className={`text-sm font-medium ${isActive ? "text-primary" : "text-foreground"}`}>
                    {p.first_name} {p.last_name}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 min-h-0 space-y-4">
          <PlayerDocuments player={selectedPlayer} />
        </div>

        {/* Safe area bottom spacer */}
        <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
      </div>
    </div>
  );
}