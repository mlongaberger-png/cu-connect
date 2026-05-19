import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Crown, User } from "lucide-react";

const LEADERSHIP_ROLES = ["coach", "athletic_director", "admin"];

export default function NewDmDialog({ open, onOpenChange, currentUser, onChannelCreated }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const queryClient = useQueryClient();

  const { data: allUsers = [] } = useQuery({
    queryKey: ["all-users-for-dm"],
    queryFn: () => base44.entities.User.list(),
    enabled: open,
  });

  // Exclude self
  const contacts = allUsers.filter(u => u.email !== currentUser?.email);

  const leadership = contacts.filter(c => LEADERSHIP_ROLES.includes(c.role));
  const parents = contacts.filter(c => !LEADERSHIP_ROLES.includes(c.role));

  const filteredParents = useMemo(() => {
    if (!search.trim()) return parents;
    const q = search.toLowerCase();
    return parents.filter(c => (c.full_name || c.email).toLowerCase().includes(q));
  }, [parents, search]);

  // When searching, also show leadership matches
  const filteredLeadership = useMemo(() => {
    if (!search.trim()) return leadership;
    const q = search.toLowerCase();
    return leadership.filter(c => (c.full_name || c.email).toLowerCase().includes(q));
  }, [leadership, search]);

  const createMutation = useMutation({
    mutationFn: async (contact) => {
      // Check if a direct channel already exists for these two users
      const existing = await base44.entities.Channel.filter({ type: "direct" });
      const myEmail = currentUser?.email;
      const theirEmail = contact.email;
      const found = existing.find(ch => {
        try {
          const members = JSON.parse(ch.member_emails || "[]");
          return members.includes(myEmail) && members.includes(theirEmail);
        } catch { return false; }
      });
      if (found) return found;
      return base44.entities.Channel.create({
        type: "direct",
        name: contact.full_name || contact.email,
        member_emails: JSON.stringify([myEmail, theirEmail]),
      });
    },
    onSuccess: (channel) => {
      queryClient.invalidateQueries({ queryKey: ["channels", "direct"] });
      onChannelCreated(channel.id);
      onOpenChange(false);
      setSelected(null);
      setSearch("");
    },
  });

  const ContactRow = ({ contact, isLeadership }) => {
    const isSelected = selected?.email === contact.email;
    return (
      <button
        onClick={() => setSelected(contact)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors
          ${isSelected ? "bg-primary/20 border border-primary/40" : isLeadership ? "bg-yellow-500/5 border border-yellow-500/20 hover:bg-yellow-500/10" : "hover:bg-surface"}
        `}
      >
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold
          ${isLeadership ? "bg-yellow-500/20 text-yellow-400" : "bg-primary/20 text-primary"}`}>
          {isLeadership ? <Crown className="w-4 h-4" /> : (contact.full_name?.[0] || contact.email?.[0] || "?")}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground truncate">{contact.full_name || contact.email}</div>
          {contact.full_name && <div className="text-xs text-muted-foreground truncate">{contact.email}</div>}
        </div>
        {isLeadership && (
          <span className="text-xs text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full shrink-0 capitalize">
            {contact.role?.replace("_", " ")}
          </span>
        )}
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setSelected(null); setSearch(""); } }}>
      <DialogContent className="max-w-sm max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>New Direct Message</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 space-y-1 pr-1">
          {/* Search — filters both sections */}
          <Input
            placeholder="Search by name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="mb-3"
          />

          {/* Leadership Section */}
          {filteredLeadership.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                Staff & Coaches
              </h3>
              <div className="space-y-1">
                {filteredLeadership.map(c => <ContactRow key={c.id} contact={c} isLeadership />)}
              </div>
            </div>
          )}

          {/* Divider */}
          {filteredLeadership.length > 0 && filteredParents.length > 0 && <div className="border-t border-border my-3" />}

          {/* Parents Section */}
          <div className="space-y-1">
            {filteredParents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No contacts found.</p>
            ) : filteredParents.map(c => <ContactRow key={c.id} contact={c} isLeadership={false} />)}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end pt-3 border-t border-border mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!selected || createMutation.isPending}
            onClick={() => selected && createMutation.mutate(selected)}
          >
            {createMutation.isPending ? "Opening…" : "Open Chat"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}