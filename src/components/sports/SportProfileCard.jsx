import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Pencil, Check, X, Users, Trophy, Image } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function SportProfileCard({ sport, teams, canEdit, onRegisterClick }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...sport });
  const [uploadingImage, setUploadingImage] = useState(false);
  const queryClient = useQueryClient();

  const sportTeams = teams.filter(t => t.sport_id === sport.id && t.is_active !== false);

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Sport.update(sport.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sports"] });
      setEditing(false);
    }
  });

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, hero_image_url: file_url }));
    setUploadingImage(false);
  };

  const handleSave = () => updateMutation.mutate(form);
  const handleCancel = () => { setForm({ ...sport }); setEditing(false); };

  if (editing) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-foreground text-lg">Edit {sport.name}</h3>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleCancel}><X className="w-4 h-4" /></Button>
            <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending} className="bg-primary text-primary-foreground">
              <Check className="w-4 h-4 mr-1" /> Save
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Hero Image</Label>
            <div className="flex items-center gap-3 mt-1">
              {form.hero_image_url && <img src={form.hero_image_url} alt="" className="h-16 w-28 object-cover rounded-lg border border-border" />}
              <label className="cursor-pointer flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-dashed border-border rounded-lg px-3 py-2">
                <Image className="w-4 h-4" />
                {uploadingImage ? "Uploading…" : "Upload Image"}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            </div>
          </div>
          <div>
            <Label className="text-xs">Age Groups</Label>
            <Input value={form.age_groups || ""} onChange={e => setForm(f => ({ ...f, age_groups: e.target.value }))} placeholder="e.g. 8U, 10U, 12U, 14U" className="bg-surface border-border mt-1" />
          </div>
          <div>
            <Label className="text-xs">Overview (Who We Are)</Label>
            <Textarea value={form.overview || ""} onChange={e => setForm(f => ({ ...f, overview: e.target.value }))} rows={4} placeholder="Tell families about your program, mission, and values…" className="bg-surface border-border mt-1" />
          </div>
          <div>
            <Label className="text-xs">What to Expect</Label>
            <Textarea value={form.what_to_expect || ""} onChange={e => setForm(f => ({ ...f, what_to_expect: e.target.value }))} rows={4} placeholder="Practice schedule, season commitment, costs, culture…" className="bg-surface border-border mt-1" />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={!!form.registration_open} onCheckedChange={v => setForm(f => ({ ...f, registration_open: v }))} />
            <Label className="text-sm">Registration Open</Label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 transition-all group">
      {/* Hero Image */}
      {sport.hero_image_url ? (
        <div className="h-40 relative overflow-hidden">
          <img src={sport.hero_image_url} alt={sport.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-3 left-4 flex items-center gap-2">
            <span className="text-3xl">{sport.icon || "🏅"}</span>
            <div>
              <h3 className="text-white font-bold text-lg leading-tight">{sport.strikeout}{sport.name}</h3>
              <span className="text-xs text-white/70 capitalize">{(sport.season || "").replace("_", " ")}</span>
            </div>
          </div>
          {canEdit && (
            <button onClick={() => setEditing(true)} className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity">
              <Pencil className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="p-5 pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{sport.icon || "🏅"}</span>
              <div>
                <h3 className="text-lg font-bold text-foreground">{sport.name}</h3>
                <span className="text-xs text-muted-foreground capitalize">{(sport.season || "").replace("_", " ")}</span>
              </div>
            </div>
            {canEdit && (
              <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg hover:bg-surface text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="p-5 space-y-3">
        {/* Stats row */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" /> {sportTeams.length} team{sportTeams.length !== 1 ? "s" : ""}
          </span>
          {sport.age_groups && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-surface text-muted-foreground">{sport.age_groups}</span>
          )}
          {sport.registration_open && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
              Registration Open
            </span>
          )}
        </div>

        {/* Description */}
        {sport.description && (
          <p className="text-sm text-muted-foreground">{sport.description}</p>
        )}

        {/* Overview */}
        {sport.overview && (
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">About This Program</p>
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">{sport.overview}</p>
          </div>
        )}

        {/* What to Expect */}
        {sport.what_to_expect && (
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">What to Expect</p>
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{sport.what_to_expect}</p>
          </div>
        )}

        {/* Teams list */}
        {sportTeams.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Teams</p>
            <div className="flex flex-wrap gap-1.5">
              {sportTeams.map(t => (
                <span key={t.id} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{t.name}</span>
              ))}
            </div>
          </div>
        )}

        {/* Register button */}
        {sport.registration_open && !canEdit && (
          <Button onClick={() => onRegisterClick(sport)} className="w-full bg-primary text-primary-foreground mt-2">
            Register an Athlete
          </Button>
        )}
      </div>
    </div>
  );
}