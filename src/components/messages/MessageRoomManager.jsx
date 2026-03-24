import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Lock, Globe, Trash2, Pencil } from "lucide-react";

export default function MessageRoomManager({ currentUser }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", is_private: false, allowed_roles: "", allowed_emails: "" });

  const { data: rooms = [] } = useQuery({
    queryKey: ["message-rooms"],
    queryFn: () => base44.entities.MessageRoom.filter({ is_active: true }),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.MessageRoom.update(editing.id, data)
      : base44.entities.MessageRoom.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["message-rooms"] });
      setShowForm(false);
      setEditing(null);
      setForm({ name: "", description: "", is_private: false, allowed_roles: "", allowed_emails: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MessageRoom.update(id, { is_active: false }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["message-rooms"] }),
  });

  const openEdit = (room) => {
    setEditing(room);
    setForm({
      name: room.name,
      description: room.description || "",
      is_private: room.is_private || false,
      allowed_roles: room.allowed_roles || "",
      allowed_emails: room.allowed_emails || "",
    });
    setShowForm(true);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Custom Rooms</h3>
        <Button size="sm" onClick={() => { setEditing(null); setForm({ name: "", description: "", is_private: false, allowed_roles: "", allowed_emails: "" }); setShowForm(true); }} className="bg-primary text-primary-foreground">
          <Plus className="w-3.5 h-3.5 mr-1" /> New Room
        </Button>
      </div>

      {rooms.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No custom rooms yet.</p>
      ) : (
        <div className="space-y-2">
          {rooms.map(room => (
            <div key={room.id} className="flex items-center gap-2 bg-surface rounded-xl px-3 py-2.5">
              {room.is_private ? <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <Globe className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{room.name}</p>
                {room.description && <p className="text-xs text-muted-foreground truncate">{room.description}</p>}
              </div>
              <button onClick={() => openEdit(room)} className="text-muted-foreground hover:text-foreground p-1">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => deleteMutation.mutate(room.id)} className="text-muted-foreground hover:text-red-400 p-1">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Room" : "Create Room"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Room Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-surface border-border" placeholder="e.g. Coaches Only" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-surface border-border" rows={2} placeholder="Optional description" />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={!form.is_private} onChange={() => setForm(f => ({ ...f, is_private: false }))} />
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Public</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={form.is_private} onChange={() => setForm(f => ({ ...f, is_private: true }))} />
                <Lock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Private</span>
              </label>
            </div>
            {form.is_private && (
              <>
                <div>
                  <Label>Allowed Roles (comma-separated)</Label>
                  <Input value={form.allowed_roles} onChange={e => setForm(f => ({ ...f, allowed_roles: e.target.value }))} className="bg-surface border-border" placeholder="e.g. admin, coach" />
                  <p className="text-xs text-muted-foreground mt-1">Leave blank to use allowed emails only</p>
                </div>
                <div>
                  <Label>Allowed Emails (comma-separated)</Label>
                  <Textarea value={form.allowed_emails} onChange={e => setForm(f => ({ ...f, allowed_emails: e.target.value }))} className="bg-surface border-border" rows={2} placeholder="coach@email.com, director@email.com" />
                </div>
              </>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)} className="border-border">Cancel</Button>
              <Button onClick={() => saveMutation.mutate({ ...form, created_by: currentUser?.email, created_by_name: currentUser?.full_name })} disabled={!form.name || saveMutation.isPending} className="bg-primary text-primary-foreground">
                {saveMutation.isPending ? "Saving…" : editing ? "Save Changes" : "Create Room"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}