import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { BookOpen, Plus, Pencil, Trash2, Users, Eye, BarChart2, ArrowLeft, Upload, ClipboardList } from "lucide-react";
import UploadPlaybookModal from "@/components/playbooks/UploadPlaybookModal";
import AssignmentCreatorDialog from "@/components/playbooks/AssignmentCreatorDialog";
import CoachAssignmentDashboard from "@/components/playbooks/CoachAssignmentDashboard";
import AthleteAssignmentsTab from "@/components/playbooks/AthleteAssignmentsTab";
import { Button } from "@/components/ui/button";
import PlaybookEditor from "@/components/playbooks/PlaybookEditor";
import AthletePlaybookView from "@/components/playbooks/AthletePlaybookView";
import { format } from "date-fns";

export default function Playbooks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const role = user?.role;
  const isStaff = ["admin", "athletic_director", "coach"].includes(role);
  const isParent = role === "parent" || role === "user";

  const [editingPlaybook, setEditingPlaybook] = useState(null);
  const [uploadingPlaybook, setUploadingPlaybook] = useState(false);
  const [viewingPlaybook, setViewingPlaybook] = useState(null);
  const [viewingStats, setViewingStats] = useState(null);
  const [assigningPlaybook, setAssigningPlaybook] = useState(null);
  const [activeTab, setActiveTab] = useState("playbooks");
  const [openSubmission, setOpenSubmission] = useState(null);

  const { data: playbooks = [] } = useQuery({
    queryKey: ["playbooks"],
    queryFn: () => base44.entities.Playbook.list("-created_date"),
  });
  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });
  const { data: allPlayers = [] } = useQuery({
    queryKey: ["players"],
    queryFn: () => base44.entities.Player.list(),
  });

  // For parents: determine their kids and filter accessible playbooks
  const { data: guardianLinks = [] } = useQuery({
    queryKey: ["guardian-links-playbooks", user?.email],
    queryFn: () => base44.entities.PlayerGuardian.filter({ user_email: user?.email }),
    enabled: isParent && !!user?.email,
  });

  const myKids = isParent
    ? allPlayers.filter(p => {
        const linkedIds = new Set(guardianLinks.map(g => g.player_id));
        return linkedIds.has(p.id) || p.parent_email === user?.email;
      })
    : [];
  const myTeamIds = new Set(myKids.map(k => k.team_id));

  const visiblePlaybooks = isStaff
    ? playbooks
    : playbooks.filter(pb => pb.status === "published" && pb.parent_visible && myTeamIds.has(pb.team_id));

  const handleDeletePlaybook = async (id) => {
    if (!confirm("Delete this playbook?")) return;
    await base44.entities.Playbook.delete(id);
    queryClient.invalidateQueries({ queryKey: ["playbooks"] });
  };

  // Stats view
  const StatsView = ({ playbook }) => {
    const { data: plays = [] } = useQuery({
      queryKey: ["plays", playbook.id],
      queryFn: () => base44.entities.Play.filter({ playbook_id: playbook.id }),
    });
    const { data: reviews = [] } = useQuery({
      queryKey: ["all-reviews", playbook.id],
      queryFn: () => base44.entities.PlayReview.filter({ playbook_id: playbook.id }),
    });
    const teamPlayers = allPlayers.filter(p => p.team_id === playbook.team_id && p.is_active !== false);

    return (
      <div className="space-y-4">
        <button onClick={() => setViewingStats(null)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Playbooks
        </button>
        <div className="bg-card rounded-2xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-1">{playbook.name}</h3>
          <p className="text-xs text-muted-foreground mb-4">{plays.length} plays · {teamPlayers.length} athletes</p>
          <div className="space-y-2">
            {teamPlayers.map(player => {
              const playerReviews = reviews.filter(r => r.player_id === player.id);
              const pct = plays.length > 0 ? Math.round((playerReviews.length / plays.length) * 100) : 0;
              const lastReview = playerReviews.sort((a, b) => new Date(b.reviewed_at) - new Date(a.reviewed_at))[0];
              return (
                <div key={player.id} className="flex items-center gap-3">
                  <div className="w-32 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{player.first_name} {player.last_name}</p>
                    {lastReview && <p className="text-[10px] text-muted-foreground">{format(new Date(lastReview.reviewed_at), "MMM d")}</p>}
                  </div>
                  <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                </div>
              );
            })}
            {teamPlayers.length === 0 && <p className="text-sm text-muted-foreground">No players on this team.</p>}
          </div>
        </div>
      </div>
    );
  };

  if (viewingStats) return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <StatsView playbook={viewingStats} />
    </div>
  );

  if (viewingPlaybook) {
    const kid = myKids.find(k => k.team_id === viewingPlaybook.team_id) || myKids[0];
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
        <button onClick={() => { setViewingPlaybook(null); setOpenSubmission(null); }} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Playbooks
        </button>
        <AthletePlaybookView
          playbook={viewingPlaybook}
          player={kid}
          userEmail={user?.email}
          submission={openSubmission}
          onSubmissionUpdated={() => queryClient.invalidateQueries({ queryKey: ["my-submissions", kid?.id] })}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" /> Playbooks
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isStaff ? "Create and manage team playbooks" : "Your team's assigned playbooks"}
          </p>
        </div>
        {isStaff && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setUploadingPlaybook(true)} className="gap-1 border-border text-sm">
              <Upload className="w-4 h-4" /> Upload File
            </Button>
            <Button onClick={() => setEditingPlaybook({})} className="bg-primary text-primary-foreground gap-1">
              <Plus className="w-4 h-4" /> New Playbook
            </Button>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-surface rounded-xl p-1">
        <button
          onClick={() => setActiveTab("playbooks")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "playbooks" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <BookOpen className="w-4 h-4" /> Playbooks
        </button>
        <button
          onClick={() => setActiveTab("assignments")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "assignments" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <ClipboardList className="w-4 h-4" /> Assignments
        </button>
      </div>

      {/* Assignments tab */}
      {activeTab === "assignments" && (
        isStaff
          ? <CoachAssignmentDashboard user={user} />
          : <AthleteAssignmentsTab
              player={myKids[0]}
              userEmail={user?.email}
              onOpenAssignment={(sub) => {
                const pb = visiblePlaybooks.find(p => p.id === sub.playbook_id);
                if (pb) { setOpenSubmission(sub); setViewingPlaybook(pb); }
              }}
            />
      )}

      {/* Playbook grid */}
      {activeTab === "playbooks" && visiblePlaybooks.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-2xl border border-border">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">
            {isStaff ? "No playbooks yet. Create your first one!" : "No playbooks assigned yet."}
          </p>
          {isStaff && (
            <div className="flex gap-3 justify-center flex-wrap">
              <Button variant="outline" onClick={() => setUploadingPlaybook(true)} className="gap-1.5 border-border">
                <Upload className="w-4 h-4" /> Upload Playbook File
              </Button>
              <Button onClick={() => setEditingPlaybook({})} className="bg-primary text-primary-foreground gap-1.5">
                <Plus className="w-4 h-4" /> Build from Scratch
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visiblePlaybooks.map(pb => {
            const team = teams.find(t => t.id === pb.team_id);
            return (
              <div key={pb.id} className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground">{pb.name}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${pb.status === "published" ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"}`}>
                        {pb.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{team?.name || pb.team_name}{pb.season ? ` · ${pb.season}` : ""}</p>
                    {pb.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{pb.description}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{pb.assigned_to === "all" ? "Entire Team" : pb.assigned_to}</span>
                  {pb.parent_visible && <span>👀 Parent visible</span>}
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setViewingPlaybook(pb)}
                    className="gap-1 border-border text-xs"
                  >
                    <Eye className="w-3.5 h-3.5" /> View Plays
                  </Button>
                  {isStaff && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setAssigningPlaybook(pb)} className="gap-1 border-primary/30 text-primary hover:bg-primary/10 text-xs">
                        <ClipboardList className="w-3.5 h-3.5" /> Assign
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingPlaybook(pb)} className="gap-1 border-border text-xs">
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setViewingStats(pb)} className="gap-1 border-border text-xs">
                        <BarChart2 className="w-3.5 h-3.5" /> Progress
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDeletePlaybook(pb.id)} className="gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assign dialog */}
      {assigningPlaybook && (
        <AssignmentCreatorDialog
          playbook={assigningPlaybook}
          teams={teams}
          players={allPlayers}
          user={user}
          onClose={() => setAssigningPlaybook(null)}
          onCreated={() => { setAssigningPlaybook(null); setActiveTab("assignments"); }}
        />
      )}

      {/* Upload modal */}
      {uploadingPlaybook && (
        <UploadPlaybookModal
          teams={teams}
          user={user}
          onClose={() => setUploadingPlaybook(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ["playbooks"] });
            setUploadingPlaybook(false);
          }}
        />
      )}

      {/* Editor modal */}
      {editingPlaybook !== null && (
        <PlaybookEditor
          playbook={editingPlaybook?.id ? editingPlaybook : null}
          teams={teams}
          user={user}
          onClose={(created) => {
            setEditingPlaybook(null);
            if (created?.id) setEditingPlaybook(created);
          }}
        />
      )}
    </div>
  );
}