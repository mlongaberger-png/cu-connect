import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Check, User, Search, AlertCircle, UserCheck } from "lucide-react";

const GRADES = ["Pre-K", "K", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];

function normalizeStr(s) {
  return (s || "").toLowerCase().trim();
}

export default function AddChildForm({ parentEmail, parentName, onChildAdded, onSkip, showSkip = true }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ first_name: "", last_name: "", date_of_birth: "", grade: "", sport_interest: "" });
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [addedChildren, setAddedChildren] = useState([]);
  const [showForm, setShowForm] = useState(true);

  const { data: allPlayers = [] } = useQuery({
    queryKey: ["players-all"],
    queryFn: () => base44.entities.Player.list(),
  });

  const { data: sports = [] } = useQuery({
    queryKey: ["sports"],
    queryFn: () => base44.entities.Sport.list(),
  });

  // Auto-suggest matching players
  useEffect(() => {
    const fn = normalizeStr(form.first_name);
    const ln = normalizeStr(form.last_name);
    if (!fn && !ln) { setSuggestions([]); return; }
    const matches = allPlayers.filter(p => {
      const pfn = normalizeStr(p.first_name);
      const pln = normalizeStr(p.last_name);
      const nameMatch = (fn && pfn.startsWith(fn)) || (ln && pln.startsWith(ln));
      const dobMatch = !form.date_of_birth || !p.date_of_birth || p.date_of_birth === form.date_of_birth;
      return nameMatch && dobMatch;
    });
    setSuggestions(matches);
    if (selectedMatch && !matches.find(m => m.id === selectedMatch.id)) setSelectedMatch(null);
  }, [form.first_name, form.last_name, form.date_of_birth, allPlayers]);

  const handleSelectSuggestion = (player) => {
    setSelectedMatch(player);
    setForm(f => ({ ...f, first_name: player.first_name, last_name: player.last_name, date_of_birth: player.date_of_birth || "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!confirmed) { setError("Please confirm the guardian acknowledgment."); return; }
    setError("");
    setSaving(true);

    try {
      if (selectedMatch) {
        // Link parent to existing player via PlayerGuardian
        const existingLinks = await base44.entities.PlayerGuardian.filter({ player_id: selectedMatch.id, user_email: parentEmail });
        if (!existingLinks.length) {
          await base44.entities.PlayerGuardian.create({
            player_id: selectedMatch.id,
            player_name: `${selectedMatch.first_name} ${selectedMatch.last_name}`,
            user_email: parentEmail,
            relationship: "Guardian",
            invited_by: parentEmail,
          });
        }
        const child = { ...selectedMatch, _linked: true, _label: `${selectedMatch.first_name} ${selectedMatch.last_name}` };
        setAddedChildren(prev => [...prev, child]);
        queryClient.invalidateQueries({ queryKey: ["my-guardian-links"] });
        if (onChildAdded) onChildAdded(child);
      } else {
        // Create PendingChild record
        const pending = await base44.entities.PendingChild.create({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          date_of_birth: form.date_of_birth || undefined,
          grade: form.grade || undefined,
          sport_interest: form.sport_interest || undefined,
          parent_email: parentEmail,
          parent_name: parentName || "",
          status: "pending",
          guardian_confirmed: true,
        });
        const child = { ...pending, _label: `${form.first_name} ${form.last_name}` };
        setAddedChildren(prev => [...prev, child]);
        if (onChildAdded) onChildAdded(child);
      }

      setSaving(false);
      setForm({ first_name: "", last_name: "", date_of_birth: "", grade: "", sport_interest: "" });
      setConfirmed(false);
      setSelectedMatch(null);
      setShowForm(false);
    } catch (err) {
      setSaving(false);
      setError(err?.message || "Failed to save. Please try again.");
    }
  };

  const handleAddAnother = () => {
    setShowForm(true);
    setSelectedMatch(null);
  };

  return (
    <div className="space-y-5">
      {/* Added children list */}
      {addedChildren.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Children Added</p>
          {addedChildren.map((c, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                <Check className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{c._label}</p>
                <p className="text-xs text-muted-foreground">{c._linked ? "Linked to existing profile" : "Submitted for review"}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>First Name *</Label>
              <Input
                required
                placeholder="Alex"
                value={form.first_name}
                onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                className="bg-surface border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Last Name *</Label>
              <Input
                required
                placeholder="Smith"
                value={form.last_name}
                onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                className="bg-surface border-border"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Date of Birth</Label>
            <Input
              type="date"
              value={form.date_of_birth}
              onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))}
              className="bg-surface border-border"
            />
          </div>

          {/* Auto-suggest matches */}
          {suggestions.length > 0 && !selectedMatch && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-amber-400 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5" /> Possible Matches Found
              </p>
              {suggestions.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectSuggestion(p)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                    <UserCheck className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{p.first_name} {p.last_name}</p>
                    <p className="text-xs text-amber-400">Possible Match — click to link instead of creating duplicate</p>
                    {p.team_name && <p className="text-xs text-muted-foreground">{p.team_name}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedMatch && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <UserCheck className="w-4 h-4 text-blue-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Linking to existing profile: {selectedMatch.first_name} {selectedMatch.last_name}</p>
              </div>
              <button type="button" onClick={() => setSelectedMatch(null)} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
            </div>
          )}

          {!selectedMatch && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Grade <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <select
                    value={form.grade}
                    onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
                    className="w-full h-9 rounded-md border border-input bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Select grade</option>
                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>

              {sports.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Sport Interest <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <div className="flex flex-wrap gap-2">
                    {sports.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, sport_interest: f.sport_interest === s.name ? "" : s.name }))}
                        className={`px-3 py-1 rounded-lg text-xs border transition-all ${form.sport_interest === s.name ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                      >
                        {s.icon && <span className="mr-1">{s.icon}</span>}{s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Guardian acknowledgment */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="mt-0.5 shrink-0"
            />
            <span className="text-xs text-muted-foreground leading-relaxed">
              I confirm that I am the parent or legal guardian of this child and consent to their information being stored in this system for youth sports management purposes.
            </span>
          </label>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? "Saving…" : selectedMatch ? "Link Child" : "Add Child"}
            </Button>
            {addedChildren.length === 0 && showSkip && onSkip && (
              <Button type="button" variant="outline" onClick={onSkip} className="border-border">
                Skip for Now
              </Button>
            )}
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <Button variant="outline" onClick={handleAddAnother} className="gap-2 border-border">
            <Plus className="w-4 h-4" /> Add Another Child
          </Button>
          {onSkip && (
            <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
              {addedChildren.length > 0 ? "Continue →" : "Skip for Now"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}