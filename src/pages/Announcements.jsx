import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Megaphone, Pin, Trash2, AlertTriangle, RefreshCw } from "lucide-react";
import usePullToRefresh from "@/hooks/usePullToRefresh";
import { format } from "date-fns";

import { useAdminOrADGuard } from "@/hooks/useRoleGuard";

const priorityStyles = {
  normal: "border-border",
  important: "border-primary/40 bg-primary/5",
  urgent: "border-red-500/40 bg-red-500/5",
};

export default function Announcements() {
  useAdminOrADGuard();
  const [showForm, setShowForm] = useState(false);
  const EMPTY = { title: "", content: "", priority: "normal", target: "org", target_id: "", is_pinned: false,
    show_on_website: false, website_featured: false, website_category: "club", event_date: "", event_details: "" };
  const [form, setForm] = useState(EMPTY);
  const queryClient = useQueryClient();

  const refreshing = usePullToRefresh(async () => {
    await queryClient.invalidateQueries({ queryKey: ["announcements"] });
  });

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => base44.entities.Announcement.list("-created_date"),
  });
  const { data: sports = [] } = useQuery({
    queryKey: ["sports"],
    queryFn: () => base44.entities.Sport.list(),
  });
  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Announcement.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["announcements"] }); setShowForm(false); setForm(EMPTY); },
  });

  // Post an existing announcement to (or pull it from) the public website.
  const websiteMutation = useMutation({
    mutationFn: ({ id, on }) => base44.entities.Announcement.update(id, on ? { show_on_website: true } : { show_on_website: false, website_featured: false }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["announcements"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Announcement.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["announcements"] }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    let targetName = "Organization";
    if (form.target === "sport") {
      const s = sports.find(x => x.id === form.target_id);
      targetName = s?.name || "";
    } else if (form.target === "team") {
      const t = teams.find(x => x.id === form.target_id);
      targetName = t?.name || "";
    }
    const data = { ...form, target_name: targetName, author_name: "Admin" };
    if (!data.show_on_website) { data.website_featured = false; }
    if (!data.event_date) delete data.event_date;
    if (!data.event_details) delete data.event_details;
    createMutation.mutate(data);
  };

  const sorted = [...announcements].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return 0;
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {refreshing && <div className="flex justify-center"><div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Announcements</h1>
          <p className="text-sm text-muted-foreground mt-1">Keep everyone informed</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-primary text-primary-foreground">
          <Plus className="w-4 h-4 mr-2" /> New Announcement
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-28 bg-card rounded-2xl animate-pulse border border-border" />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-border">
          <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground">No announcements</h3>
          <p className="text-muted-foreground">Create the first announcement</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map((ann) => (
            <div key={ann.id} className={`bg-card rounded-2xl border p-6 ${priorityStyles[ann.priority] || priorityStyles.normal}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {ann.is_pinned && <Pin className="w-4 h-4 text-primary" />}
                    {ann.priority === "urgent" && <AlertTriangle className="w-4 h-4 text-red-400" />}
                    <h3 className="text-lg font-semibold text-foreground">{ann.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ann.content}</p>
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{ann.priority}</span>
                    {ann.show_on_website && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">
                        On website{ann.website_featured ? " · featured" : ""}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => websiteMutation.mutate({ id: ann.id, on: !ann.show_on_website })}
                      className="text-xs text-primary hover:underline"
                    >
                      {ann.show_on_website ? "Remove from website" : "Post to website"}
                    </button>
                    {ann.target_name && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-surface text-muted-foreground">
                        {ann.target_name}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {ann.author_name && `By ${ann.author_name} • `}
                      {ann.created_date ? format(new Date(ann.created_date), "MMM d, yyyy") : ""}
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(ann.id)} className="text-muted-foreground hover:text-red-400 h-8 w-8">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border text-foreground max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Announcement</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="bg-surface border-border" required /></div>
            <div><Label>Content</Label><Textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} className="bg-surface border-border h-32" required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm({...form, priority: v})}>
                  <SelectTrigger className="bg-surface border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="important">Important</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Target Audience</Label>
                <Select value={form.target} onValueChange={v => setForm({...form, target: v, target_id: ""})}>
                  <SelectTrigger className="bg-surface border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="org">Entire Organization</SelectItem>
                    <SelectItem value="sport">Specific Sport</SelectItem>
                    <SelectItem value="team">Specific Team</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.target === "sport" && (
              <div>
                <Label>Select Sport</Label>
                <Select value={form.target_id} onValueChange={v => setForm({...form, target_id: v})}>
                  <SelectTrigger className="bg-surface border-border"><SelectValue placeholder="Choose sport" /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {sports.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.target === "team" && (
              <div>
                <Label>Select Team</Label>
                <Select value={form.target_id} onValueChange={v => setForm({...form, target_id: v})}>
                  <SelectTrigger className="bg-surface border-border"><SelectValue placeholder="Choose team" /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Switch checked={form.is_pinned} onCheckedChange={v => setForm({...form, is_pinned: v})} />
              <Label>Pin this announcement</Label>
            </div>
            <div className="rounded-xl border border-border p-3 space-y-3">
              <div className="flex items-center gap-3">
                <Switch checked={form.show_on_website} onCheckedChange={v => setForm({...form, show_on_website: v})} />
                <div>
                  <Label>Also post on the public website</Label>
                  <p className="text-xs text-muted-foreground">Anyone can see it on the website's News page. Leave off for family-only news.</p>
                </div>
              </div>
              {form.show_on_website && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Website label</Label>
                      <Select value={form.website_category} onValueChange={v => setForm({...form, website_category: v})}>
                        <SelectTrigger className="bg-surface border-border"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-popover border-border">
                          <SelectItem value="club">Club</SelectItem>
                          <SelectItem value="event">Event</SelectItem>
                          <SelectItem value="fundraiser">Fundraiser</SelectItem>
                          <SelectItem value="football">Football</SelectItem>
                          <SelectItem value="baseball">Baseball</SelectItem>
                          <SelectItem value="cheer">Cheer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Event date (optional)</Label>
                      <Input type="date" value={form.event_date} onChange={e => setForm({...form, event_date: e.target.value})} className="bg-surface border-border" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={form.website_featured} onCheckedChange={v => setForm({...form, website_featured: v})} />
                    <div>
                      <Label>Feature on the website home page</Label>
                      <p className="text-xs text-muted-foreground">Shows in the big card at the top. Hides itself the day after the event date.</p>
                    </div>
                  </div>
                  {form.website_featured && (
                    <div>
                      <Label>Card details (optional)</Label>
                      <Input value={form.event_details} onChange={e => setForm({...form, event_details: e.target.value})} placeholder="Junior High Football 5:30 PM | JV Football 7:00 PM" className="bg-surface border-border" />
                      <p className="text-xs text-muted-foreground mt-1">Separate lines with |</p>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="border-border">Cancel</Button>
              <Button type="submit" className="bg-primary text-primary-foreground">Publish</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}