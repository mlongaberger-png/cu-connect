import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Pencil, Trash2, ShieldCheck, Mail, MessageSquare, Phone, UserCircle,
  ClipboardList, FileText, DollarSign, Settings, Users2
} from "lucide-react";
import { useAdminGuard } from "@/hooks/useRoleGuard";
import StaffInvitePanel from "@/components/admin/StaffInvitePanel";
import PendingChildrenPanel from "@/components/admin/PendingChildrenPanel";
import ParentAccountsTab from "@/components/admin/ParentAccountsTab";
import AccessRequestsPanel from "@/components/admin/AccessRequestsPanel";
import RegistrationsTab from "@/components/admin/RegistrationsTab";
import LeadershipApplicationsTab from "@/components/admin/LeadershipApplicationsTab";
import SeasonManager from "@/pages/SeasonManager";
import DataExport from "@/pages/DataExport";
import LegalPages from "@/pages/LegalPages";
import AuditLog from "@/pages/AuditLog";

const empty = { name: "", email: "", google_chat_url: "", sport_id: "", sport_name: "", phone: "", title: "Athletic Director" };

const TABS = [
  { id: "people",        label: "People",        icon: Users2,        desc: "Staff, parents & access requests" },
  { id: "registrations", label: "Registrations", icon: ClipboardList, desc: "Athlete & leadership applications" },
  { id: "finance",       label: "Finance",       icon: DollarSign,    desc: "Payments & invoices" },
  { id: "content",       label: "Content",       icon: FileText,      desc: "Documents & legal pages" },
  { id: "settings",      label: "Settings",      icon: Settings,      desc: "Seasons, data & audit log" },
];

export default function AthleticDirectors() {
  useAdminGuard();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("people");
  const [peopleSubTab, setPeopleSubTab] = useState("staff");
  const [registrationsSubTab, setRegistrationsSubTab] = useState("athletes");
  const [settingsSubTab, setSettingsSubTab] = useState("seasons");
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
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Console</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage all aspects of Cornerstone United</p>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-1 bg-surface rounded-xl p-1 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
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

      {/* ── PEOPLE ── */}
      {activeTab === "people" && (
        <div className="space-y-5">
          <div className="flex gap-1 w-fit">
            {[
              { id: "staff", label: "Staff & Admins" },
              { id: "parents", label: "Parent Accounts" },
              { id: "access", label: "Access Requests" },
              { id: "children", label: "Child Submissions" },
            ].map(sub => (
              <button key={sub.id} onClick={() => setPeopleSubTab(sub.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${peopleSubTab === sub.id ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"}`}>
                {sub.label}
              </button>
            ))}
          </div>

          {peopleSubTab === "staff" && (
            <>
              <div className="flex justify-end">
                <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Add Staff Contact</Button>
              </div>
              <StaffInvitePanel />
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
                        <button onClick={() => openEdit(ad)} className="p-1.5 rounded-lg hover:bg-surface text-muted-foreground hover:text-foreground transition-colors"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => deleteMutation.mutate(ad.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-4 h-4" /></button>
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

          {peopleSubTab === "parents" && <ParentAccountsTab />}
          {peopleSubTab === "access" && <AccessRequestsPanel />}
          {peopleSubTab === "children" && <PendingChildrenPanel />}
        </div>
      )}

      {/* ── REGISTRATIONS ── */}
      {activeTab === "registrations" && (
        <div className="space-y-5">
          <div className="flex gap-1 w-fit">
            {[
              { id: "athletes", label: "Athlete Registrations" },
              { id: "leadership", label: "Leadership Applications" },
            ].map(sub => (
              <button key={sub.id} onClick={() => setRegistrationsSubTab(sub.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${registrationsSubTab === sub.id ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"}`}>
                {sub.label}
              </button>
            ))}
          </div>
          {registrationsSubTab === "athletes" && <RegistrationsTab />}
          {registrationsSubTab === "leadership" && <LeadershipApplicationsTab />}
        </div>
      )}

      {/* ── FINANCE ── */}
      {activeTab === "finance" && (
        <div className="text-center py-16 text-muted-foreground">
          <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Finance tools are available via the Teams page → individual team payments.</p>
        </div>
      )}

      {/* ── CONTENT ── */}
      {activeTab === "content" && (
        <div className="space-y-5">
          <div className="flex gap-1 w-fit">
            {[
              { id: "legal", label: "Legal Pages" },
            ].map(sub => (
              <button key={sub.id} onClick={() => {}}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground">
                {sub.label}
              </button>
            ))}
          </div>
          <LegalPages embedded />
        </div>
      )}

      {/* ── SETTINGS ── */}
      {activeTab === "settings" && (
        <div className="space-y-5">
          <div className="flex gap-1 w-fit">
            {[
              { id: "seasons", label: "Season Manager" },
              { id: "data", label: "Import / Export" },
              { id: "audit", label: "Audit Log" },
            ].map(sub => (
              <button key={sub.id} onClick={() => setSettingsSubTab(sub.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${settingsSubTab === sub.id ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:text-foreground"}`}>
                {sub.label}
              </button>
            ))}
          </div>
          {settingsSubTab === "seasons" && <SeasonManager embedded />}
          {settingsSubTab === "data" && <DataExport embedded />}
          {settingsSubTab === "audit" && <AuditLog embedded />}
        </div>
      )}

      {/* Staff Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Staff Contact" : "Add Staff Contact"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" required /></div>
            <div className="space-y-1.5"><Label>Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Athletic Director" /></div>
            <div className="space-y-1.5"><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="ad@example.com" required /></div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(555) 000-0000" /></div>
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
            <div className="space-y-1.5"><Label>Google Chat Link or Email</Label><Input value={form.google_chat_url} onChange={e => setForm(f => ({ ...f, google_chat_url: e.target.value }))} placeholder="https://chat.google.com/..." /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit">{editing ? "Save Changes" : "Add Contact"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}