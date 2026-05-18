import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare, MessagesSquare, Settings2,
} from "lucide-react";
import MessageRoomManager from "@/components/messages/MessageRoomManager";
import DirectMessagePanel from "@/components/messages/DirectMessagePanel";
import CreateAttendanceDialog from "@/components/attendance/CreateAttendanceDialog";
import ChannelList from "@/components/messages/ChannelList";
import MessagingTermsGate from "@/components/messages/MessagingTermsGate";
import ChatPanel from "@/components/messages/ChatPanel";
import { useAuth } from "@/lib/AuthContext";

// ─── Read/unread helpers ───────────────────────────────────────────────────
function markChannelRead(channelId) {
  try { localStorage.setItem(`msg_read_${channelId}`, String(Date.now())); } catch {}
}

// ─── Main component ────────────────────────────────────────────────────────
export default function Messages() {
  const { user } = useAuth();
  const role = user?.role;
  const isStaff = ["admin", "athletic_director", "coach"].includes(role);
  const isParent = role === "parent" || role === "user";

  // Mobile view: "list" | "chat"
  const [mobileView, setMobileView] = useState("list");

  const [channel, setChannel] = useState("org");
  const [channelId, setChannelId] = useState("org");
  const [channelName, setChannelName] = useState("Organization");
  const [parentChannelReady, setParentChannelReady] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("channels");
  const [dmContact, setDmContact] = useState(null);
  const [locallyBlockedEmails, setLocallyBlockedEmails] = useState(new Set());
  const selectChannelTimer = useRef(null);
  const pendingChannelRef = useRef(null);

  const queryClient = useQueryClient();

  const isTeamChannel = channel === "team";

  // ── Data fetching ─────────────────────────────────────────────────────────
  const { data: sports = [] } = useQuery({ queryKey: ["sports"], queryFn: () => base44.entities.Sport.list() });
  const { data: teams = [] }  = useQuery({ queryKey: ["teams"],  queryFn: () => base44.entities.Team.list() });
  const { data: allPlayers = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["all-users-dm"],
    queryFn: () => base44.entities.User.list(),
    enabled: isStaff,
  });
  const parentUsers = allUsers.filter(u => ["parent", "user"].includes(u.role));

  // Fetch blocked users for the current user
  const { data: blockedUsers = [] } = useQuery({
    queryKey: ["blocked-users", user?.email],
    queryFn: () => base44.entities.BlockedUser.filter({ blocker_email: user?.email }),
    enabled: !!user?.email,
    staleTime: 60000,
  });
  const blockedEmailsFromDB = new Set(blockedUsers.map(b => b.blocked_email));
  const allBlockedEmails = new Set([...blockedEmailsFromDB, ...locallyBlockedEmails]);

  const handleBlockUser = (email) => {
    setLocallyBlockedEmails(prev => new Set([...prev, email]));
  };

  const { data: guardianLinks = [] } = useQuery({
    queryKey: ["guardian-links-messages"],
    queryFn: () => base44.entities.PlayerGuardian.filter({ user_email: user?.email }),
    enabled: isParent && !!user?.email,
  });

  const myFilterTeamIds = useMemo(() => {
    if (!isParent) return null;
    const linkedIds = new Set(guardianLinks.map(g => g.player_id));
    const myKids = allPlayers.filter(p => linkedIds.has(p.id) || p.parent_email === user?.email);
    return [...new Set(myKids.map(k => k.team_id))];
  }, [isParent, guardianLinks, allPlayers, user?.email]);

  const myPlayers = useMemo(() => {
    if (!isParent) return [];
    const linkedIds = new Set(guardianLinks.map(g => g.player_id));
    return allPlayers.filter(p => linkedIds.has(p.id) || p.parent_email === user?.email);
  }, [isParent, guardianLinks, allPlayers, user?.email]);

  // Auto-set parent's first team channel on load
  useEffect(() => {
    if (!isParent || parentChannelReady || teams.length === 0) return;
    const linkedPlayerIds = new Set(guardianLinks.map(g => g.player_id));
    const myPlayers = allPlayers.filter(p => linkedPlayerIds.has(p.id) || p.parent_email === user?.email);
    const myTeamIds = [...new Set(myPlayers.map(p => p.team_id))];
    if (myTeamIds.length > 0) {
      const firstTeam = teams.find(t => t.id === myTeamIds[0]);
      if (firstTeam) {
        setChannel("team");
        setChannelId(firstTeam.id);
        setChannelName(firstTeam.name);
        setParentChannelReady(true);
      }
    }
  }, [isParent, guardianLinks, allPlayers, teams, parentChannelReady, user?.email]);



  const myCoachTeams = role === "coach"
    ? teams.filter(t => t.coach_email && t.coach_email.toLowerCase() === (user?.email || "").toLowerCase())
    : teams;

  const canPostAttendance = isStaff && isTeamChannel && (
    role === "admin" || role === "athletic_director" ||
    (role === "coach" && myCoachTeams.some(t => t.id === channelId))
  );

  // Mark channel as read when chat view opens
  useEffect(() => {
    if (mobileView === "chat") markChannelRead(channelId);
  }, [mobileView, channelId]);

  const selectChannel = useCallback((type, id, name) => {
    // If same channel — no-op immediately
    if (pendingChannelRef.current === id) return;
    pendingChannelRef.current = id;

    // Cancel any queued switch that hasn't fired yet
    if (selectChannelTimer.current) clearTimeout(selectChannelTimer.current);

    selectChannelTimer.current = setTimeout(() => {
      selectChannelTimer.current = null;
      setChannelId(prev => {
        if (prev === id) return prev;
        markChannelRead(id);
        // Cancel in-flight fetches for the previous channel before switching
        queryClient.cancelQueries({ queryKey: ["messages-init", prev] });
        queryClient.removeQueries({ queryKey: ["messages-init", prev] });
        return id;
      });
      setChannel(type);
      setChannelName(name);
      setMobileView("chat");
    }, 120); // 120ms debounce — absorbs double-taps without feeling laggy
  }, [queryClient]);

  const currentTeam = teams.find(t => t.id === channelId);

  const myCoachContacts = useMemo(() => {
    if (!isParent) return [];
    const linkedIds = new Set(guardianLinks.map(g => g.player_id));
    const myKids = allPlayers.filter(p => linkedIds.has(p.id) || p.parent_email === user?.email);
    const myTids = [...new Set(myKids.map(p => p.team_id))];
    return teams
      .filter(t => myTids.includes(t.id) && t.coach_email)
      .map(t => ({ email: t.coach_email, name: t.head_coach || t.coach_email, role: "coach", teamName: t.name }));
  }, [isParent, guardianLinks, allPlayers, teams, user?.email]);

  // Same-team parents for parent DMs
  const { data: allGuardianLinks = [] } = useQuery({
    queryKey: ["all-guardian-links-dm"],
    queryFn: () => base44.entities.PlayerGuardian.list(),
    enabled: isParent,
  });
  // Build same-team parent contacts from player records only (no User.list needed)
  const sameTeamParents = useMemo(() => {
    if (!isParent) return [];
    const linkedIds = new Set(guardianLinks.map(g => g.player_id));
    const myKids = allPlayers.filter(p => linkedIds.has(p.id) || p.parent_email === user?.email);
    const myTids = new Set(myKids.map(p => p.team_id));
    const seen = new Set();
    const contacts = [];
    // From guardian links
    allGuardianLinks
      .filter(g => {
        const player = allPlayers.find(p => p.id === g.player_id);
        return player && myTids.has(player.team_id) && g.user_email !== user?.email;
      })
      .forEach(g => {
        if (!seen.has(g.user_email)) {
          seen.add(g.user_email);
          contacts.push({ email: g.user_email, name: g.user_email, role: "parent" });
        }
      });
    // From player parent_email fields
    allPlayers
      .filter(p => myTids.has(p.team_id) && p.parent_email && p.parent_email !== user?.email)
      .forEach(p => {
        if (!seen.has(p.parent_email)) {
          seen.add(p.parent_email);
          contacts.push({ email: p.parent_email, name: p.parent_name || p.parent_email, role: "parent" });
        }
      });
    return contacts;
  }, [isParent, guardianLinks, allPlayers, allGuardianLinks, user?.email]);

  // ── Shared ChatPanel props ─────────────────────────────────────────────────
  const chatPanelProps = {
    channel,
    channelId,
    channelName,
    user,
    isStaff,
    teams,
    sports,
    canPostAttendance,
    onShowAttendance: () => setShowAttendanceDialog(true),
    onBlockUser: handleBlockUser,
    locallyBlockedEmails,
  };

  // ── DM list (desktop sidebar) ─────────────────────────────────────────────
  const DmList = () => (
    <div className="flex-1 overflow-y-auto p-2">
      {isStaff && (
        <>
          <p className="text-xs text-muted-foreground uppercase tracking-wider px-2 mb-2">Parents</p>
          {parentUsers.length === 0 && <p className="text-xs text-muted-foreground px-2">No parents found</p>}
          {parentUsers.map(u => (
            <button key={u.id}
              onClick={() => setDmContact({ email: u.email, name: u.full_name || u.email, role: u.role })}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors mb-0.5 ${dmContact?.email === u.email ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:bg-surface hover:text-foreground"}`}>
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                {(u.full_name || u.email)[0].toUpperCase()}
              </div>
              <span className="truncate">{u.full_name || u.email}</span>
            </button>
          ))}
        </>
      )}
      {isParent && (
        <>
          <p className="text-xs text-muted-foreground uppercase tracking-wider px-2 mb-2">Coaches</p>
          {myCoachContacts.length === 0 && <p className="text-xs text-muted-foreground px-2">No coaches found</p>}
          {myCoachContacts.map((c, i) => (
            <button key={i}
              onClick={() => setDmContact(c)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors mb-0.5 ${dmContact?.email === c.email ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:bg-surface hover:text-foreground"}`}>
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                {(c.name || c.email)[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm">{c.name || c.email}</p>
                <p className="text-xs text-muted-foreground truncate">{c.teamName}</p>
              </div>
            </button>
          ))}
          {sameTeamParents.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground uppercase tracking-wider px-2 mt-4 mb-2">Team Parents</p>
              {sameTeamParents.map((c, i) => (
                <button key={i}
                  onClick={() => setDmContact(c)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors mb-0.5 ${dmContact?.email === c.email ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:bg-surface hover:text-foreground"}`}>
                  <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400 flex-shrink-0">
                    {(c.name || c.email)[0].toUpperCase()}
                  </div>
                  <span className="truncate">{c.name || c.email}</span>
                </button>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <MessagingTermsGate>
    <div className="flex flex-col h-full overflow-hidden md:flex-row">

      {/* ── Desktop sidebar ── */}
      <div className="hidden md:flex md:h-full flex-col w-64 bg-card border-r border-border flex-shrink-0">
        <div className="flex border-b border-border">
          <button onClick={() => setActiveTab("channels")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${activeTab === "channels" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>
            <MessageSquare className="w-3.5 h-3.5" /> Channels
          </button>
          <button onClick={() => setActiveTab("direct")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${activeTab === "direct" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>
            <MessagesSquare className="w-3.5 h-3.5" /> Direct
          </button>
          {(role === "admin" || role === "athletic_director") && (
            <button onClick={() => setActiveTab("rooms")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${activeTab === "rooms" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <Settings2 className="w-3.5 h-3.5" /> Rooms
            </button>
          )}
        </div>

        {activeTab === "channels" && (
          <ChannelList
            sports={sports}
            teams={teams}
            filterTeamIds={myFilterTeamIds}
            userRole={role}
            userEmail={user?.email}
            activeChannelId={channelId}
            onSelectChannel={selectChannel}
          />
        )}
        {activeTab === "rooms" && (
          <div className="flex-1 overflow-y-auto"><MessageRoomManager currentUser={user} /></div>
        )}
        {activeTab === "direct" && <DmList />}
      </div>

      {/* ── Mobile: channel list view ── */}
      <div className={`md:hidden flex-1 h-full flex flex-col bg-background overflow-hidden ${mobileView === "list" ? "" : "hidden"}`}>
        <div className="px-4 py-3 border-b border-border bg-card flex items-center gap-2 flex-shrink-0">
          <MessageSquare className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">Messages</h2>
        </div>
        <ChannelList
          sports={sports}
          teams={teams}
          filterTeamIds={myFilterTeamIds}
          userRole={role}
          userEmail={user?.email}
          activeChannelId={channelId}
          onSelectChannel={selectChannel}
        />
      </div>

      {/* ── Mobile: chat view ── */}
      <div className={`md:hidden flex-1 h-full flex flex-col overflow-hidden ${mobileView === "chat" ? "" : "hidden"}`}>
        {activeTab === "direct"
          ? <DirectMessagePanel currentUser={user} contact={dmContact} isStaff={isStaff} />
          : <ChatPanel {...chatPanelProps} onBack={() => setMobileView("list")} />
        }
      </div>

      {/* ── Desktop: chat area ── */}
      <div className="hidden md:flex md:h-full flex-1 flex-col min-w-0 overflow-hidden">
        {activeTab === "direct"
          ? <DirectMessagePanel currentUser={user} contact={dmContact} isStaff={isStaff} />
          : <ChatPanel {...chatPanelProps} />
        }
      </div>

      {/* Create Attendance Dialog */}
      {showAttendanceDialog && (
        <CreateAttendanceDialog
          open={showAttendanceDialog}
          onOpenChange={setShowAttendanceDialog}
          channelId={channelId}
          teamId={channelId}
          teamName={currentTeam?.name || channelName}
          user={user}
        />
      )}
    </div>
    </MessagingTermsGate>
  );
}