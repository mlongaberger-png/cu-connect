import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Pin, AlertTriangle, Megaphone, X, ChevronDown } from "lucide-react";
import { format } from "date-fns";

const priorityStyles = {
  normal: "border-border",
  important: "border-primary/40 bg-primary/5",
  urgent: "border-red-500/40 bg-red-500/5",
};

const BLANK = { title: "", content: "", priority: "normal", target: "org", target_id: "", is_pinned: false };

export default function AnnouncementsPanel({ channel, channelId, channelName, sports, teams }) {
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK);
  const queryClient = useQueryClient();

  const { data: announcements = [] } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => base44.entities.Announcement.list("-created_date"),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Announcement.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      setShowForm(false);
      setForm(BLANK);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Announcement.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["announcements"] }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    let targetName = "Organization";
    if (form.target === "sport") targetName = sports.find(x => x.id === form.target_id)?.name || "";
    else if (form.target === "team") targetName = teams.find(x => x.id === form.target_id)?.name || "";
    createMutation.mutate({ ...form, target_name: targetName, author_name: "Admin" });
  };

  // Filter to current channel scope
  const relevant = [...announcements].filter(a => {
    if (a.target === "org") return true;
    if (a.target === "sport" && channel === "sport" && a.target_id === channelId) return true;
    if (a.target === "team" && channel === "team" && a.target_id === channelId) return true;
    return false;
  }).sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => { setOpen(!open); setShowForm(false); }}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <Megaphone className="w-4 h-4" />
        <span className="hidden sm:inline text-xs">Announcements</span>
        {relevant.length > 0 && (
          <span className="text-xs bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center leading-none">
            {relevant.length > 9 ? "9+" : relevant.length}
          </span>
        )}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[420px] max-w-[calc(100vw-2rem)] bg-card border border-border rounded-2xl shadow-2xl z-50 flex flex-col max-h-[70vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
            <div>
              <h3 className="font-semibold text-foreground text-sm">Announcements</h3>
              <p className="text-xs text-muted-foreground">#{channelName}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" onClick={() => setShowForm(!showForm)} className="bg-primary text-primary-foreground h-7 text-xs px-2">
                <Plus className="w-3 h-3 mr-1" /> New
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="h-7 w-7 text-muted-foreground">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Create Form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="p-4 border-b border-border space-y-3 flex-shrink-0 overflow-y-auto">
              <div>
                <Label className="text-xs">Title</Label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="bg-surface border-border h-8 text-sm" required />
              </div>
              <div>
                <Label className="text-xs">Content</Label>
                <Textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="bg-surface border-border h-20 text-sm" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Priority</Label>
                  <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                    <SelectTrigger className="bg-surface border-border h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="important">Important</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Audience</Label>
                  <Select value={form.target} onValueChange={v => setForm({ ...form, target: v, target_id: "" })}>
                    <SelectTrigger className="bg-surface border-border h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="org">Entire Org</SelectItem>
                      <SelectItem value="sport">Sport</SelectItem>
                      <SelectItem value="team">Team</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.target === "sport" && (
                <Select value={form.target_id} onValueChange={v => setForm({ ...form, target_id: v })}>
                  <SelectTrigger className="bg-surface border-border h-8 text-sm"><SelectValue placeholder="Choose sport" /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {sports.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {form.target === "team" && (
                <Select value={form.target_id} onValueChange={v => setForm({ ...form, target_id: v })}>
                  <SelectTrigger className="bg-surface border-border h-8 text-sm"><SelectValue placeholder="Choose team" /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <div className="flex items-center gap-2">
                <Switch checked={form.is_pinned} onCheckedChange={v => setForm({ ...form, is_pinned: v })} />
                <Label className="text-xs">Pin this announcement</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)} className="border-border h-7 text-xs">Cancel</Button>
                <Button type="submit" size="sm" className="bg-primary text-primary-foreground h-7 text-xs">Publish</Button>
              </div>
            </form>
          )}

          {/* List */}
          <div className="overflow-y-auto flex-1 p-3 space-y-2">
            {relevant.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Megaphone className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No announcements for this channel</p>
              </div>
            ) : relevant.map(ann => (
              <div key={ann.id} className={`rounded-xl border p-3 ${priorityStyles[ann.priority] || priorityStyles.normal}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      {ann.is_pinned && <Pin className="w-3 h-3 text-primary flex-shrink-0" />}
                      {ann.priority === "urgent" && <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                      <span className="text-sm font-semibold text-foreground truncate">{ann.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{ann.content}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{ann.priority}</span>
                      {ann.target_name && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface text-muted-foreground">{ann.target_name}</span>}
                      <span className="text-[10px] text-muted-foreground">{ann.created_date ? format(new Date(ann.created_date), "MMM d") : ""}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(ann.id)} className="h-6 w-6 text-muted-foreground hover:text-red-400 flex-shrink-0">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}