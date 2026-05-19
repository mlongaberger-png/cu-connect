import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Check, MessageSquare } from "lucide-react";

export default function NewDmDialog({ open, onOpenChange, contacts, onStart }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return contacts.filter(c =>
      (c.name || c.email).toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
  }, [contacts, search]);

  const roleLabel = { coach: "Coach", admin: "Admin", athletic_director: "Athletic Director", parent: "Parent", user: "Parent" };
  const roleColor = { coach: "text-yellow-400", admin: "text-primary", athletic_director: "text-primary", parent: "text-blue-400", user: "text-blue-400" };

  const handleStart = () => {
    if (!selected) return;
    onStart(selected);
    setSelected(null);
    setSearch("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setSelected(null); setSearch(""); } }}>
      <DialogContent className="bg-card border-border text-foreground max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" /> New Message
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 bg-surface border-border text-sm"
          />
        </div>

        <div className="max-h-64 overflow-y-auto space-y-0.5 -mx-1">
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">No contacts found</p>
          )}
          {filtered.map((c, i) => {
            const isSelected = selected?.email === c.email;
            return (
              <button
                key={i}
                onClick={() => setSelected(isSelected ? null : c)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${isSelected ? "bg-primary/15 text-primary" : "hover:bg-surface text-foreground"}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isSelected ? "bg-primary text-primary-foreground" : "bg-surface border border-border text-muted-foreground"}`}>
                  {isSelected ? <Check className="w-3.5 h-3.5" /> : (c.name || c.email)[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{c.name || c.email}</p>
                  <p className={`text-xs truncate ${roleColor[c.role] || "text-muted-foreground"}`}>
                    {roleLabel[c.role] || c.role}{c.teamName ? ` · ${c.teamName}` : ""}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-1 border-t border-border">
          <Button variant="outline" size="sm" className="border-border" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" disabled={!selected} onClick={handleStart} className="bg-primary text-primary-foreground">
            Open Chat
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}