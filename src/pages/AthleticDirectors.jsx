import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, ShieldCheck, Mail, MessageSquare, Phone, UserCircle } from "lucide-react";
import { useAdminGuard } from "@/hooks/useRoleGuard";
import StaffInvitePanel from "@/components/admin/StaffInvitePanel";
import ParentAccountsTab from "@/components/admin/ParentAccountsTab";

const empty = { name: "", email: "", google_chat_url: "", sport_id: "", sport_name: "", phone: "", title: "Athletic Director" };

const TABS = [
  { id: "staff", label: "Staff & Admins", icon: ShieldCheck },
  { id: "parents", label: "Parent Accounts", icon: UserCircle },
];

export default function AthleticDirectors() {
  useAdminGuard();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("staff");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const { data: ads = [], isLoading } = useQuery({
    queryKey: ["athletic-directors"],
    queryFn: () => base44.entities.AthleticDirector.list(),
  });

  const { data: sports = [] } = useQuery({
    queryKey: ["sports"],
    queryFn: () => base44.entities.Sport.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.AthleticDirector.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["athletic-directors"] }); closeDialog(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AthleticDirector.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["athletic-directors"] }); closeDialog(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AthleticDirector.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["athletic-directors"] }),
  });

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (ad) => { setEditing(ad); setForm({ ...ad }); setOpen(true); };
  const closeDialog = () => { setOpen(false); setEditing(null); setForm(empty); };

  const handleSportChange = (sportId) => {
    const sport = sports.find(s => s.id === sportId);
    setForm(f => ({ ...f, sport_id: sportId === "none" ? "" : sportId, sport_name: sportId === "none" ? "" : (sport?.name || "") }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage staff, contacts, and parent accounts</p>
        </div>
        {activeTab === "staff" && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> Add Admin
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-xl p-1 w-fit">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Staff Tab */}
      {activeTab === "staff" && (
        <>
          <StaffInvitePanel />

          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

          {!isLoading && ads.length === 0 && (
            <div className="text-center py-16 bg-card rounded-2xl border border-border">
              <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No athletic directors added yet.</p>
              <Button onClick={openCreate} variant="outline" className="mt-4 gap-2">
                <Plus className="w-4 h-4" /> Add First Admin
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ads.map(ad => (
              <div key={ad.id} className="bg-card rounded-2xl border border-border p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{ad.name}</p>
                      <p className="text-xs text-primary">{ad.title || "Athletic Director"}</p>
                      {ad.sport_name && <p className="text-xs text-muted-foreground mt-0.5">{ad.sport_name}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(ad)} className="p-1.5 rounded-lg hover:bg-surface text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteMutation.mutate(ad.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-primary shrink-0" /><span className="truncate">{ad.email}</span></div>
                  {ad.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-primary shrink-0" /><span>{ad.phone}</span></div>}
                  {ad.google_chat_url && <div className="flex items-center gap-2"><MessageSquare className="w-3.5 h-3.5 text-primary shrink-0" /><span className="truncate">{ad.google_chat_url}</span></div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Parent Accounts Tab */}
      {activeTab === "parents" && <ParentAccountsTab />}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Admin Contact" : "Add Admin Contact"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" required />
            </div>
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Athletic Director" />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="ad@example.com" required />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(555) 000-0000" />
            </div>
            <div className="space-y-1.5">
              <Label>Sport (optional)</Label>
              <Select value={form.sport_id || "none"} onValueChange={handleSportChange}>
                <SelectTrigger><SelectValue placeholder="All Sports / General" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">All Sports / General</SelectItem>
                  {sports.map(s => <SelectItem key={s.id} value={s.id}>{s.icon} {s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Google Chat Link or Email</Label>
              <Input value={form.google_chat_url} onChange={e => setForm(f => ({ ...f, google_chat_url: e.target.value }))} placeholder="https://chat.google.com/dm/... or email" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit">{editing ? "Save Changes" : "Add Admin"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}