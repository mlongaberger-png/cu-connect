import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Globe, Loader2, UserPlus, AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useAdminOrADGuard } from "@/hooks/useRoleGuard";

// Registrations families completed on the club website (ProgramRegistration).
// Admins place each paid athlete on a team here; placement creates the player,
// links the parent and moves the invoices into the parent's app.

const PAY = {
  pending_checkout: { label: "Not paid", cls: "bg-muted text-muted-foreground" },
  abandoned: { label: "Checkout abandoned", cls: "bg-muted text-muted-foreground" },
  deposit_paid: { label: "Payment 1 of 3 paid", cls: "bg-yellow-500/15 text-yellow-400" },
  paid_in_full: { label: "Paid in full", cls: "bg-green-500/15 text-green-400" },
  refunded: { label: "Refunded", cls: "bg-red-500/15 text-red-400" },
};
const STATUS = {
  submitted: { label: "Needs placement", icon: Clock, cls: "text-yellow-400" },
  placed: { label: "Placed", icon: CheckCircle2, cls: "text-green-400" },
  waitlist: { label: "Waitlist", icon: Clock, cls: "text-muted-foreground" },
  withdrawn: { label: "Withdrawn", icon: XCircle, cls: "text-muted-foreground" },
};
const FILTERS = [
  ["todo", "Needs placement"],
  ["placed", "Placed"],
  ["waitlist", "Waitlist"],
  ["unpaid", "Not paid"],
  ["all", "All"],
];
const money = (n) => `$${Number(n || 0).toFixed(2).replace(/\.00$/, "")}`;
const errText = (e) => e?.response?.data?.error || e?.data?.error || e?.message || "Something went wrong";

export default function WebsiteRegistrations() {
  useAdminOrADGuard();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState("todo");
  const [program, setProgram] = useState("all");
  const [placing, setPlacing] = useState(null); // registration being placed
  const [teamId, setTeamId] = useState("");
  const [noteFor, setNoteFor] = useState(null);
  const [note, setNote] = useState("");

  const { data: regs = [], isLoading } = useQuery({
    queryKey: ["website-registrations"],
    queryFn: () => base44.entities.ProgramRegistration.list("-created_date", 500),
  });
  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list("name", 500),
  });

  const programs = useMemo(() => [...new Set(regs.map((r) => r.program_name).filter(Boolean))], [regs]);
  const paid = (r) => r.payment_status === "deposit_paid" || r.payment_status === "paid_in_full";
  const shown = regs.filter((r) => {
    if (program !== "all" && r.program_name !== program) return false;
    if (filter === "todo") return paid(r) && (r.status || "submitted") === "submitted";
    if (filter === "placed") return r.status === "placed";
    if (filter === "waitlist") return r.status === "waitlist";
    if (filter === "unpaid") return !paid(r) && r.status !== "withdrawn";
    return true;
  });
  const todoCount = regs.filter((r) => paid(r) && (r.status || "submitted") === "submitted").length;

  const act = useMutation({
    mutationFn: (payload) => base44.functions.invoke("placeWebsiteRegistration", payload),
    onSuccess: (res, payload) => {
      qc.invalidateQueries({ queryKey: ["website-registrations"] });
      const msg = payload.action === "waitlist" ? "Moved to the waitlist" : payload.action === "withdraw" ? "Marked withdrawn"
        : payload.action === "note" ? "Note saved" : `Placed on ${res?.data?.team_name || "the team"}`;
      toast({ title: msg });
      setPlacing(null); setTeamId(""); setNoteFor(null);
    },
    onError: (e) => toast({ title: "Couldn't save", description: errText(e), variant: "destructive" }),
  });

  // Teams for the registration's sport, active first; the suggested team floats to the top.
  const teamOptions = (r) => {
    if (!r) return [];
    const sport = (r.sport_name || "").toLowerCase();
    return teams
      .filter((t) => t.is_active !== false && (!sport || (t.sport_name || "").toLowerCase() === sport))
      .sort((a, b) => (b.name === r.suggested_program_name) - (a.name === r.suggested_program_name) || a.name.localeCompare(b.name));
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Globe className="w-6 h-6 text-primary" /> Website Registrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Families who registered and paid on the club website. Place each athlete on a team; that adds them to the roster, the team chat and the parent's app, with their remaining invoices.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setFilter(k)}
            className={`min-h-[36px] rounded-full border px-3.5 text-sm font-medium ${filter === k ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {label}{k === "todo" && todoCount > 0 ? ` (${todoCount})` : ""}
          </button>
        ))}
        {programs.length > 1 && (
          <Select value={program} onValueChange={setProgram}>
            <SelectTrigger className="w-56 bg-surface border-border ml-auto"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">All programs</SelectItem>
              {programs.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="h-32 bg-card rounded-2xl animate-pulse border border-border" />
      ) : shown.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border text-muted-foreground">Nothing here.</div>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => {
            const pay = PAY[r.payment_status] || PAY.pending_checkout;
            const st = STATUS[r.status || "submitted"] || STATUS.submitted;
            const Icon = st.icon;
            return (
              <div key={r.id} className="bg-card rounded-2xl border border-border p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-semibold text-foreground">{r.athlete_first_name} {r.athlete_last_name}</span>
                      {r.test_mode && <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">Test</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${pay.cls}`}>{pay.label}</span>
                      <span className={`text-xs inline-flex items-center gap-1 ${st.cls}`}><Icon className="w-3.5 h-3.5" />{r.status === "placed" ? `Placed on ${r.placed_team_name}` : st.label}</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {r.program_name} · age {r.league_age ?? "?"} on cutoff · born {r.athlete_dob}
                      {r.age_review_needed && (
                        <span className="ml-2 inline-flex items-center gap-1 text-yellow-400"><AlertTriangle className="w-3.5 h-3.5" />Age points to {r.suggested_program_name || "another team"}</span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {r.parent_first_name} {r.parent_last_name} · <a className="text-primary" href={`mailto:${r.parent_email}`}>{r.parent_email}</a> · {r.parent_phone}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {r.confirmation_code} · {r.payment_plan === "three_payments" ? "3 payments" : "Paid in full"} · total {money(r.total)}
                      {r.jersey_size ? ` · jersey ${r.jersey_size}` : ""}{r.pants_size ? ` · pants ${r.pants_size}` : ""}
                      {r.positions ? ` · ${r.positions}` : ""}{r.experience_years != null ? ` · ${r.experience_years} yrs exp.` : ""}
                    </div>
                    {r.medical_notes && <div className="text-xs mt-1 text-red-300">Medical: {r.medical_notes}</div>}
                    {r.admin_notes && <div className="text-xs mt-1 text-foreground/80">Note: {r.admin_notes}</div>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {paid(r) && r.status !== "withdrawn" && (
                      <Button size="sm" onClick={() => { setPlacing(r); setTeamId(teamOptions(r)[0]?.id || ""); }} className="bg-primary text-primary-foreground">
                        <UserPlus className="w-4 h-4 mr-1.5" />{r.status === "placed" ? "Move" : "Place on team"}
                      </Button>
                    )}
                    {r.status !== "waitlist" && r.status !== "placed" && paid(r) && (
                      <Button size="sm" variant="outline" className="border-border" onClick={() => act.mutate({ registration_id: r.id, action: "waitlist" })}>Waitlist</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => { setNoteFor(r); setNote(r.admin_notes || ""); }}>Note</Button>
                    {r.status !== "withdrawn" && r.status !== "placed" && (
                      <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => act.mutate({ registration_id: r.id, action: "withdraw" })}>Withdraw</Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!placing} onOpenChange={(o) => !o && setPlacing(null)}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader><DialogTitle>Place {placing?.athlete_first_name} {placing?.athlete_last_name}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Registered for {placing?.program_name}. Suggested from age: <span className="text-foreground">{placing?.suggested_program_name || "none"}</span>.
          </p>
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger className="bg-surface border-border"><SelectValue placeholder="Choose a team" /></SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {teamOptions(placing).map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}{t.age_group ? ` (${t.age_group})` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Adds the athlete to the roster and team chat, gives the parent the schedule, and moves the remaining invoices into their app. The parent gets a notification.
          </p>
          <DialogFooter>
            <Button variant="outline" className="border-border" onClick={() => setPlacing(null)}>Cancel</Button>
            <Button disabled={!teamId || act.isPending} onClick={() => act.mutate({ registration_id: placing.id, team_id: teamId })} className="bg-primary text-primary-foreground">
              {act.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Place on team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!noteFor} onOpenChange={(o) => !o && setNoteFor(null)}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader><DialogTitle>Admin note</DialogTitle></DialogHeader>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="bg-surface border-border h-28" placeholder="Only admins see this." />
          <DialogFooter>
            <Button variant="outline" className="border-border" onClick={() => setNoteFor(null)}>Cancel</Button>
            <Button onClick={() => act.mutate({ registration_id: noteFor.id, action: "note", note })} className="bg-primary text-primary-foreground">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
