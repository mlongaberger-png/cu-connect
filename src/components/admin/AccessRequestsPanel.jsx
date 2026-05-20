import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Clock, User, Mail, Phone, Users, Trophy, FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";

export default function AccessRequestsPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [reviewingReq, setReviewingReq] = useState(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState([]);
  const [alternateEmail, setAlternateEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState("pending");
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerTeamFilter, setPlayerTeamFilter] = useState("all");
  const [playerSportFilter, setPlayerSportFilter] = useState("all");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["access-requests"],
    queryFn: () => base44.entities.AccessRequest.list("-created_date"),
  });

  const { data: players = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
  });

  // Unique sports and teams for filters
  const sportOptions = useMemo(() => [...new Set(players.map(p => p.sport_name).filter(Boolean))].sort(), [players]);
  const teamOptions = useMemo(() => {
    const base = playerSportFilter !== "all" ? players.filter(p => p.sport_name === playerSportFilter) : players;
    return [...new Set(base.map(p => p.team_name).filter(Boolean))].sort();
  }, [players, playerSportFilter]);

  const filteredPlayers = useMemo(() => {
    return players.filter(p => {
      if (!p.is_active) return false;
      if (playerSportFilter !== "all" && p.sport_name !== playerSportFilter) return false;
      if (playerTeamFilter !== "all" && p.team_name !== playerTeamFilter) return false;
      if (playerSearch) {
        const q = playerSearch.toLowerCase();
        return `${p.first_name} ${p.last_name}`.toLowerCase().includes(q);
      }
      return true;
    });
  }, [players, playerSportFilter, playerTeamFilter, playerSearch]);

  const filtered = filter === "all" ? requests : requests.filter(r => r.status === filter);
  const pendingCount = requests.filter(r => r.status === "pending").length;

  const openReview = (req) => {
    setReviewingReq(req);
    setSelectedPlayerIds([]);
    setAlternateEmail(req.alternate_email || "");
    setPlayerSearch("");
    setPlayerTeamFilter("all");
    setPlayerSportFilter("all");
  };

  const togglePlayer = (pid) => {
    setSelectedPlayerIds(prev =>
      prev.includes(pid) ? prev.filter(id => id !== pid) : [...prev, pid]
    );
  };

  const handleAction = (action) => {
    const reqToProcess = reviewingReq;
    const playerIds = [...selectedPlayerIds];
    const altEmail = alternateEmail.trim() || undefined;

    setReviewingReq(null);
    toast({ title: action === "approve" ? "Approving parent account…" : "Rejecting request…" });

    base44.functions.invoke("approveParentRequest", {
      request_id: reqToProcess.id,
      action,
      player_ids: action === "approve" ? playerIds : [],
      alternate_email: altEmail,
    }).then(res => {
      if (res.data?.success) {
        if (action === "approve") {
          const msg = res.data.invited
            ? "✅ Invitation sent to new parent"
            : "✅ Existing account found — linked successfully";
          toast({ title: msg });
        } else {
          toast({ title: "Request rejected." });
        }
      } else {
        toast({ title: "Approval failed", description: res.data?.error || "Something went wrong. Please try again.", variant: "destructive" });
        queryClient.invalidateQueries({ queryKey: ["access-requests"] });
      }
      queryClient.invalidateQueries({ queryKey: ["access-requests"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    }).catch(() => {
      toast({ title: "Approval failed", description: "Something went wrong. Please try again.", variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["access-requests"] });
    });
  };

  const statusBadge = (status) => {
    if (status === "pending") return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Pending</Badge>;
    if (status === "approved") return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Approved</Badge>;
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Rejected</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground">Signup Requests</h3>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-semibold">{pendingCount} pending</span>
          )}
        </div>
        <div className="flex gap-1 bg-surface rounded-lg p-1">
          {["pending", "approved", "rejected", "all"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all capitalize ${
                filter === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-surface animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 bg-surface rounded-2xl border border-border">
          <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">No {filter === "all" ? "" : filter} requests.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(req => (
            <div
              key={req.id}
              className="flex items-center gap-3 p-4 rounded-xl bg-surface border border-border hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => openReview(req)}
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-primary font-semibold text-sm">{(req.parent_name || "?")[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-foreground">{req.parent_name}</span>
                  {statusBadge(req.status)}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                  <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{req.parent_email}</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{req.child_names}</span>
                  {req.sport_interest && <span className="flex items-center gap-1"><Trophy className="w-3 h-3" />{req.sport_interest}</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {req.created_date ? format(new Date(req.created_date), "MMM d, yyyy") : ""}
                  {req.reviewed_by && ` · Reviewed by ${req.reviewed_by}`}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant={req.status === "pending" ? "default" : "outline"}
                  className={req.status === "pending" ? "bg-green-600 hover:bg-green-700 text-white h-8 px-3" : "h-8 px-3 text-xs"}
                  onClick={e => { e.stopPropagation(); openReview(req); }}
                >
                  {req.status === "pending" ? "Review" : "Edit"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={!!reviewingReq} onOpenChange={() => setReviewingReq(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
            {reviewingReq?.status === "rejected" ? "Re-review Rejected Request" : reviewingReq?.status === "approved" ? "Edit Approved Request" : "Review Access Request"}
          </DialogTitle>
          </DialogHeader>
          {reviewingReq && (
            <div className="space-y-4 py-1">
              {/* Parent Info */}
              <div className="bg-surface rounded-xl p-4 space-y-2 text-sm">
                <div className="flex items-center gap-2"><User className="w-4 h-4 text-primary" /><span className="font-medium">{reviewingReq.parent_name}</span></div>
                <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /><span>{reviewingReq.parent_email}</span></div>
                {reviewingReq.parent_phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /><span>{reviewingReq.parent_phone}</span></div>}
                <div className="flex items-center gap-2"><Users className="w-4 h-4 text-primary" /><span>Children: <span className="font-medium">{reviewingReq.child_names}</span></span></div>
                {reviewingReq.sport_interest && <div className="flex items-center gap-2"><Trophy className="w-4 h-4 text-primary" /><span>{reviewingReq.sport_interest}</span></div>}
                {reviewingReq.notes && <div className="flex items-start gap-2"><FileText className="w-4 h-4 text-primary mt-0.5" /><span className="text-muted-foreground">{reviewingReq.notes}</span></div>}
              </div>

              {/* Apple ID / Alternate Email */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <span>Apple ID / Alternate Login Email</span>
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  If the parent uses Sign in with Apple, their portal account will use a private relay email (e.g. <span className="font-mono">abc123@privaterelay.appleid.com</span>). Enter it here so they get access automatically when they sign in.
                </p>
                <Input
                  placeholder="abc123@privaterelay.appleid.com"
                  value={alternateEmail}
                  onChange={e => setAlternateEmail(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>

              {/* Link to Players */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Link to existing player(s) <span className="text-muted-foreground font-normal">(optional)</span>
                  {selectedPlayerIds.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-semibold">{selectedPlayerIds.length} selected</span>
                  )}
                </p>

                {/* Filters row */}
                <div className="flex gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[120px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      className="pl-8 h-8 text-xs"
                      placeholder="Search name…"
                      value={playerSearch}
                      onChange={e => setPlayerSearch(e.target.value)}
                    />
                  </div>
                  <Select value={playerSportFilter} onValueChange={v => { setPlayerSportFilter(v); setPlayerTeamFilter("all"); }}>
                    <SelectTrigger className="h-8 text-xs w-[110px]"><SelectValue placeholder="Sport" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sports</SelectItem>
                      {sportOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={playerTeamFilter} onValueChange={setPlayerTeamFilter}>
                    <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue placeholder="Team" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Teams</SelectItem>
                      {teamOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {filteredPlayers.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-2 text-center">
                      {players.length === 0 ? "No players in the system yet." : "No players match your filters."}
                    </p>
                  ) : filteredPlayers.map(p => (
                    <label key={p.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      selectedPlayerIds.includes(p.id)
                        ? "bg-primary/10 border-primary/40"
                        : "bg-surface border-border hover:border-primary/30"
                    }`}>
                      <input
                        type="checkbox"
                        checked={selectedPlayerIds.includes(p.id)}
                        onChange={() => togglePlayer(p.id)}
                        className="accent-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{p.first_name} {p.last_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.team_name}{p.sport_name ? ` · ${p.sport_name}` : ""}{p.jersey_number ? ` · #${p.jersey_number}` : ""}
                        </p>
                      </div>
                      {selectedPlayerIds.includes(p.id) && (
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      )}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setReviewingReq(null)} className="order-last sm:order-first">
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleAction("reject")}
              className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1"
            >
              <XCircle className="w-4 h-4" /> Reject
            </Button>
            <Button
              onClick={() => handleAction("approve")}
              className="bg-green-600 hover:bg-green-700 text-white gap-1"
            >
              <CheckCircle2 className="w-4 h-4" />
              {reviewingReq?.status === "rejected" ? "Approve (Override)" : reviewingReq?.status === "approved" ? "Re-approve & Sync" : "Approve & Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}