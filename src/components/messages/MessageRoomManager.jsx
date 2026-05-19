import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Lock, Globe, Trash2, Pencil, ImagePlus, Loader2, Check, Users } from "lucide-react";

const ICON_OPTIONS = [
  { group: "Sports", icons: ["⚽","🏀","🏈","⚾","🥎","🏐","🏉","🎾","🏊","🏋️","🤸","🏇","⛷️","🏌️","🥊","🏒","🎿","🏑","🥅","🏟️"] },
  { group: "Volunteer & Events", icons: ["🙋","🤝","🎽","📋","🧢","🍕","🥤","🍉","🍪","🎉","📣","🚗","🏕️","🎪","📸","🎤","🎯","🗓️","📢","💪"] },
  { group: "General", icons: ["⭐","🔥","💬","📌","🏆","🎖️","👋","🌟","💡","📣","🔔","✅","🎁","🛡️","🦁","🌊","❤️","🤩","👏","🙌"] },
];

const EMPTY_FORM = { name: "", description: "", icon: "", is_private: false, allowed_roles: "", allowed_emails: "", allowed_team_ids: [] };

export default function MessageRoomManager({ currentUser }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const fileInputRef = useRef();

  const { data: rooms = [] } = useQuery({
    queryKey: ["message-rooms"],
    queryFn: () => base44.entities.MessageRoom.filter({ is_active: true }),
    staleTime: 0,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.MessageRoom.update(editing.id, data)
      : base44.entities.MessageRoom.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["message-rooms"] });
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_FORM);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MessageRoom.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["message-rooms"] });
      setDeleteConfirm(null);
    },
  });

  const handleIconUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIcon(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, icon: file_url }));
    } finally {
      setUploadingIcon(false);
      e.target.value = "";
    }
  };

  const openEdit = (room) => {
    let teamIds = [];
    try { teamIds = JSON.parse(room.allowed_team_ids || "[]"); } catch {}
    setEditing(room);
    setForm({
      name: room.name || "",
      description: room.description || "",
      icon: room.icon || "",
      is_private: room.is_private || false,
      allowed_roles: room.allowed_roles || "",
      allowed_emails: room.allowed_emails || "",
      allowed_team_ids: Array.isArray(teamIds) ? teamIds : [],
    });
    setShowForm(true);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const toggleTeam = (teamId) => {
    setForm(f => ({
      ...f,
      allowed_team_ids: f.allowed_team_ids.includes(teamId)
        ? f.allowed_team_ids.filter(id => id !== teamId)
        : [...f.allowed_team_ids, teamId],
    }));
  };

  const handleSave = () => {
    const payload = {
      ...form,
      allowed_team_ids: JSON.stringify(form.allowed_team_ids),
      created_by: currentUser?.email,
      created_by_name: currentUser?.full_name,
    };
    saveMutation.mutate(payload);
  };

  const getRoomTeamNames = (room) => {
    try {
      const ids = JSON.parse(room.allowed_team_ids || "[]");
      if (!ids.length) return null;
      return ids.map(id => teams.find(t => t.id === id)?.name).filter(Boolean).join(", ");
    } catch { return null; }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Custom Rooms</h3>
        <Button size="sm" onClick={openCreate} className="bg-primary text-primary-foreground">
          <Plus className="w-3.5 h-3.5 mr-1" /> New Room
        </Button>
      </div>

      {rooms.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No custom rooms yet.</p>
      ) : (
        <div className="space-y-2">
          {rooms.map(room => {
            const teamNames = getRoomTeamNames(room);
            return (
              <div key={room.id} className="flex items-center gap-2 bg-surface rounded-xl px-3 py-2.5">
                {room.icon && (room.icon.startsWith("http://") || room.icon.startsWith("https://"))
                  ? <img src={room.icon} alt="" className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
                  : room.icon
                    ? <span className="text-lg leading-none flex-shrink-0">{room.icon}</span>
                    : room.is_private
                      ? <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      : <Globe className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{room.name}</p>
                  {teamNames
                    ? <p className="text-xs text-primary/70 truncate flex items-center gap-1"><Users className="w-3 h-3" />{teamNames}</p>
                    : room.description
                      ? <p className="text-xs text-muted-foreground truncate">{room.description}</p>
                      : null
                  }
                </div>
                {deleteConfirm === room.id ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-red-400">Delete?</span>
                    <button onClick={() => deleteMutation.mutate(room.id)} className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30">Yes</button>
                    <button onClick={() => setDeleteConfirm(null)} className="text-xs px-2 py-0.5 rounded bg-surface text-muted-foreground hover:text-foreground">No</button>
                  </div>
                ) : (
                  <>
                    <button onClick={() => openEdit(room)} className="text-muted-foreground hover:text-foreground p-1"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDeleteConfirm(room.id)} className="text-muted-foreground hover:text-red-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border text-foreground max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Room" : "Create Room"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Icon Picker */}
            <div>
              <Label>Icon</Label>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setShowIconPicker(p => !p)}
                  className="w-12 h-12 rounded-xl border border-border bg-surface flex items-center justify-center text-2xl hover:border-primary/50 transition-colors overflow-hidden flex-shrink-0"
                >
                  {uploadingIcon ? (
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  ) : form.icon && (form.icon.startsWith("http://") || form.icon.startsWith("https://")) ? (
                    <img src={form.icon} alt="" className="w-full h-full object-cover" />
                  ) : form.icon ? form.icon : (
                    <span className="text-muted-foreground text-base">+</span>
                  )}
                </button>
                <div className="flex flex-col gap-1">
                  <button type="button" onClick={() => setShowIconPicker(p => !p)} className="text-xs text-muted-foreground hover:text-foreground text-left">
                    {showIconPicker ? "▲ Hide emojis" : "Pick emoji"}
                  </button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                    <ImagePlus className="w-3 h-3" /> Upload photo
                  </button>
                  {form.icon && (
                    <button type="button" onClick={() => setForm(f => ({ ...f, icon: "" }))} className="text-xs text-muted-foreground hover:text-red-400 text-left">Remove</button>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleIconUpload} />
              </div>
              {showIconPicker && (
                <div className="mt-2 border border-border rounded-xl bg-surface p-3 space-y-3 max-h-48 overflow-y-auto">
                  {ICON_OPTIONS.map(group => (
                    <div key={group.group}>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">{group.group}</p>
                      <div className="flex flex-wrap gap-1">
                        {group.icons.map(icon => (
                          <button key={icon} type="button"
                            onClick={() => { setForm(f => ({ ...f, icon })); setShowIconPicker(false); }}
                            className={`w-9 h-9 rounded-lg flex items-center justify-center text-xl hover:bg-primary/20 transition-colors ${form.icon === icon ? "bg-primary/30 ring-1 ring-primary" : ""}`}
                          >{icon}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label>Room Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-surface border-border" placeholder="e.g. Coaches Corner" />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-surface border-border" rows={2} placeholder="Optional description" />
            </div>

            {/* Team Access — add whole teams at once */}
            <div>
              <Label className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Add Teams (parents get auto-access)</Label>
              <p className="text-xs text-muted-foreground mb-2">Select teams — all parents/guardians on those teams can see this room</p>
              <div className="border border-border rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                {teams.length === 0 && <p className="text-xs text-muted-foreground p-3 text-center">No teams yet</p>}
                {teams.map(team => {
                  const selected = form.allowed_team_ids.includes(team.id);
                  return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => toggleTeam(team.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors border-b border-border last:border-0 ${selected ? "bg-primary/15 text-foreground" : "hover:bg-surface text-muted-foreground"}`}
                    >
                      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${selected ? "bg-primary border-primary" : "border-border"}`}>
                        {selected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                      </div>
                      <span className="truncate">{team.name}</span>
                      {team.sport_name && <span className="text-xs text-muted-foreground ml-auto">{team.sport_name}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={!form.is_private} onChange={() => setForm(f => ({ ...f, is_private: false }))} />
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Public (all staff + selected teams)</span>
              </label>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={form.is_private} onChange={() => setForm(f => ({ ...f, is_private: true }))} />
                <Lock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Private (roles/emails only)</span>
              </label>
            </div>

            {form.is_private && (
              <>
                <div>
                  <Label>Allowed Roles (comma-separated)</Label>
                  <Input value={form.allowed_roles} onChange={e => setForm(f => ({ ...f, allowed_roles: e.target.value }))} className="bg-surface border-border" placeholder="e.g. admin, coach" />
                </div>
                <div>
                  <Label>Additional Emails (comma-separated)</Label>
                  <Textarea value={form.allowed_emails} onChange={e => setForm(f => ({ ...f, allowed_emails: e.target.value }))} className="bg-surface border-border" rows={2} placeholder="coach@email.com, parent@email.com" />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="border-border">Cancel</Button>
              <Button onClick={handleSave} disabled={!form.name || saveMutation.isPending} className="bg-primary text-primary-foreground">
                {saveMutation.isPending ? "Saving…" : editing ? "Save Changes" : "Create Room"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}