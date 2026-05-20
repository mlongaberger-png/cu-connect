import React, { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Save, RotateCcw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const UNITS = {
  Offense: ["QB", "RB", "FB", "WR1", "WR2", "WR3", "TE", "LT", "LG", "C", "RG", "RT"],
  Defense: ["DE-L", "DT-L", "DT-R", "DE-R", "OLB-L", "MLB", "OLB-R", "CB-L", "CB-R", "SS", "FS"],
  "Special Teams": ["K", "P", "LS", "KR", "PR"],
};

function PlayerChip({ player, onDragStart, onRemove, canManage }) {
  return (
    <div
      draggable={canManage}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(player); }}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface border border-border text-xs font-medium text-foreground 
        ${canManage ? "cursor-grab active:cursor-grabbing hover:border-primary/40 hover:bg-surface/80" : ""} 
        transition-all select-none`}
    >
      {player.photo_url ? (
        <img src={player.photo_url} alt="" className="w-5 h-5 rounded-full object-cover" />
      ) : (
        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary flex-shrink-0">
          {player.jersey_number || player.first_name?.[0]}
        </div>
      )}
      <span>{player.first_name} {player.last_name[0]}.</span>
      {player.jersey_number && <span className="text-muted-foreground">#{player.jersey_number}</span>}
      {canManage && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(player); }}
          className="ml-0.5 text-muted-foreground hover:text-red-400 transition-colors leading-none"
        >×</button>
      )}
    </div>
  );
}

function PositionSlot({ slot, players, onDrop, onRemove, canManage, dragging }) {
  const [isOver, setIsOver] = useState(false);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => { e.preventDefault(); setIsOver(false); onDrop(slot); }}
      className={`rounded-xl border p-2.5 min-h-[64px] transition-all
        ${isOver && dragging ? "border-primary bg-primary/10 scale-[1.01]" : "border-border bg-card"}`}
    >
      <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">{slot}</p>
      <div className="flex flex-wrap gap-1.5">
        {players.length === 0 ? (
          <span className="text-[11px] text-muted-foreground italic">
            {dragging ? "Drop here" : "Empty"}
          </span>
        ) : (
          players
            .sort((a, b) => (a.depth_chart_order || 1) - (b.depth_chart_order || 1))
            .map(p => (
              <PlayerChip
                key={p.id}
                player={p}
                onDragStart={() => {}}
                onRemove={onRemove}
                canManage={canManage}
              />
            ))
        )}
      </div>
    </div>
  );
}

export default function DepthChartTab({ players, teamId, canManage }) {
  const [activeUnit, setActiveUnit] = useState("Offense");
  const [localPlayers, setLocalPlayers] = useState(players);
  const [dragging, setDragging] = useState(null);
  const [dirty, setDirty] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Sync when parent players prop changes (e.g. after save)
  React.useEffect(() => {
    if (!dirty) setLocalPlayers(players);
  }, [players, dirty]);

  const saveMutation = useMutation({
    mutationFn: async (updates) => {
      await Promise.all(
        updates.map(({ id, data }) => base44.entities.Player.update(id, data))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players"] });
      setDirty(false);
      toast({ title: "Depth chart saved!" });
    },
  });

  // Players in current unit slots
  const slotMap = {}; // slot -> [players]
  const slots = UNITS[activeUnit] || [];
  slots.forEach(s => { slotMap[s] = []; });
  localPlayers
    .filter(p => p.depth_chart_unit === activeUnit && p.depth_chart_slot && slots.includes(p.depth_chart_slot))
    .forEach(p => {
      if (!slotMap[p.depth_chart_slot]) slotMap[p.depth_chart_slot] = [];
      slotMap[p.depth_chart_slot].push(p);
    });

  // Unassigned players for this unit (no slot in this unit)
  const assigned = new Set(
    localPlayers.filter(p => p.depth_chart_unit === activeUnit && p.depth_chart_slot).map(p => p.id)
  );
  const unassigned = localPlayers.filter(p => !assigned.has(p.id));

  const handleDrop = (slot) => {
    if (!dragging) return;
    setLocalPlayers(prev => prev.map(p =>
      p.id === dragging.id
        ? { ...p, depth_chart_unit: activeUnit, depth_chart_slot: slot, depth_chart_order: (slotMap[slot]?.length || 0) + 1 }
        : p
    ));
    setDragging(null);
    setDirty(true);
  };

  const handleRemove = (player) => {
    setLocalPlayers(prev => prev.map(p =>
      p.id === player.id
        ? { ...p, depth_chart_unit: null, depth_chart_slot: null, depth_chart_order: null }
        : p
    ));
    setDirty(true);
  };

  const handleSave = () => {
    const updates = localPlayers.map(p => ({
      id: p.id,
      data: {
        depth_chart_unit: p.depth_chart_unit || null,
        depth_chart_slot: p.depth_chart_slot || null,
        depth_chart_order: p.depth_chart_order || null,
      }
    }));
    saveMutation.mutate(updates);
  };

  const handleReset = () => {
    setLocalPlayers(players);
    setDirty(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-foreground">Depth Chart</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {canManage ? "Drag players from the bench into position slots." : "View-only depth chart."}
          </p>
        </div>
        {canManage && dirty && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleReset} className="gap-1.5 border-border h-8 text-xs">
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="gap-1.5 bg-primary text-primary-foreground h-8 text-xs">
              <Save className="w-3.5 h-3.5" /> {saveMutation.isPending ? "Saving…" : "Save Chart"}
            </Button>
          </div>
        )}
      </div>

      {/* Unit tabs */}
      <div className="flex gap-1 bg-surface rounded-xl p-1 w-fit">
        {Object.keys(UNITS).map(unit => (
          <button
            key={unit}
            onClick={() => setActiveUnit(unit)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeUnit === unit
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {unit}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Position grid */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {slots.map(slot => (
            <PositionSlot
              key={slot}
              slot={slot}
              players={slotMap[slot] || []}
              onDrop={handleDrop}
              onRemove={canManage ? handleRemove : () => {}}
              canManage={canManage}
              dragging={dragging}
            />
          ))}
        </div>

        {/* Unassigned bench */}
        <div className="lg:w-52 shrink-0">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (dragging) { handleRemove(dragging); setDragging(null); } }}
            className="bg-card border border-border rounded-xl p-3 min-h-[100px]"
          >
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
              Bench ({unassigned.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {unassigned.length === 0 ? (
                <span className="text-[11px] text-muted-foreground italic">All players assigned</span>
              ) : (
                unassigned.map(p => (
                  <PlayerChip
                    key={p.id}
                    player={p}
                    onDragStart={setDragging}
                    onRemove={() => {}}
                    canManage={canManage}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}