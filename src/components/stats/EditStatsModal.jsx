import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Save, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";

const HITTING_FIELDS = [
  { key: "hitting_avg", label: "AVG" }, { key: "hitting_ab", label: "AB" }, { key: "hitting_h", label: "H" },
  { key: "hitting_r", label: "R" }, { key: "hitting_rbi", label: "RBI" }, { key: "hitting_hr", label: "HR" },
  { key: "hitting_bb", label: "BB" }, { key: "hitting_k", label: "K" }, { key: "hitting_obp", label: "OBP" },
  { key: "hitting_slg", label: "SLG" },
];
const PITCHING_FIELDS = [
  { key: "pitching_era", label: "ERA" }, { key: "pitching_ip", label: "IP" }, { key: "pitching_w", label: "W" },
  { key: "pitching_l", label: "L" }, { key: "pitching_so", label: "SO" }, { key: "pitching_bb", label: "BB" },
  { key: "pitching_whip", label: "WHIP" },
];
const FIELDING_FIELDS = [
  { key: "fielding_po", label: "PO" }, { key: "fielding_a", label: "A" },
  { key: "fielding_e", label: "E" }, { key: "fielding_fpct", label: "FPCT" },
];

const FIELDS_BY_TYPE = { hitting: HITTING_FIELDS, pitching: PITCHING_FIELDS, fielding: FIELDING_FIELDS };

function StatRecordEditor({ record, onSaved, onDeleted }) {
  const [values, setValues] = useState(() => {
    const fields = FIELDS_BY_TYPE[record.stat_type] || [];
    const obj = { season_label: record.season_label || "" };
    fields.forEach(f => { obj[f.key] = record[f.key] || ""; });
    return obj;
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.PlayerStats.update(record.id, values);
    setSaving(false);
    onSaved();
  };

  const handleDelete = async () => {
    await base44.entities.PlayerStats.delete(record.id);
    onDeleted();
  };

  const fields = FIELDS_BY_TYPE[record.stat_type] || [];
  const colors = { hitting: "text-yellow-400", pitching: "text-blue-400", fielding: "text-green-400" };

  return (
    <div className="rounded-xl border border-border bg-surface p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className={`text-xs font-semibold uppercase tracking-wider ${colors[record.stat_type]}`}>{record.stat_type}</p>
        <button onClick={handleDelete} className="text-muted-foreground hover:text-red-400 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Season</Label>
        <Input
          value={values.season_label}
          onChange={e => setValues(v => ({ ...v, season_label: e.target.value }))}
          placeholder="e.g. Spring 2026"
          className="h-8 text-xs bg-card border-border"
        />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {fields.map(f => (
          <div key={f.key} className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground uppercase">{f.label}</Label>
            <Input
              value={values[f.key]}
              onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
              placeholder="—"
              className="h-7 text-xs text-center bg-card border-border px-1"
            />
          </div>
        ))}
      </div>
      <Button onClick={handleSave} disabled={saving} size="sm" className="w-full gap-1.5 h-8 text-xs">
        <Save className="w-3.5 h-3.5" />
        {saving ? "Saving…" : "Save Changes"}
      </Button>
    </div>
  );
}

export default function EditStatsModal({ open, onOpenChange, player, stats = [] }) {
  const queryClient = useQueryClient();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["playerStats-all"] });
    queryClient.invalidateQueries({ queryKey: ["playerStats", player?.id] });
  };

  const handleDeleted = () => {
    queryClient.invalidateQueries({ queryKey: ["playerStats-all"] });
    queryClient.invalidateQueries({ queryKey: ["playerStats", player?.id] });
    setRefreshKey(k => k + 1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-primary" />
            Edit Stats — {player?.first_name} {player?.last_name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1" key={refreshKey}>
          {stats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No stats on file to edit.</p>
          ) : (
            stats.map(record => (
              <StatRecordEditor
                key={record.id}
                record={record}
                onSaved={handleSaved}
                onDeleted={handleDeleted}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}