import React, { useState, useRef, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send, MessageSquare, Hash, ClipboardList, MessagesSquare,
  Settings2, ArrowLeft, ChevronLeft
} from "lucide-react";
import MessageRoomManager from "@/components/messages/MessageRoomManager";
import DirectMessagePanel from "@/components/messages/DirectMessagePanel";
import { format } from "date-fns";
import MessagesSidebar from "@/components/messages/MessagesSidebar";
import AnnouncementsPanel from "@/components/messages/AnnouncementsPanel";
import CreateAttendanceDialog from "@/components/attendance/CreateAttendanceDialog";
import MessageReadReceipts from "@/components/messages/MessageReadReceipts";
import ChannelList from "@/components/messages/ChannelList";
import EventMessageCard from "@/components/messages/EventMessageCard";
import MessagingTermsGate from "@/components/messages/MessagingTermsGate";
import MessageActions from "@/components/messages/MessageActions";
import { useAuth } from "@/lib/AuthContext";

// ─── Read/unread helpers ───────────────────────────────────────────────────
function markChannelRead(channelId) {
  try { localStorage.setItem(`msg_read_${channelId}`, String(Date.now())); } catch {}
}

// ─── Role badge styles ─────────────────────────────────────────────────────
const ROLE_STYLES = {
  staff:  { border: "border-primary/50",    nameCls: "text-primary",    badge: "Staff" },
  coach:  { border: "border-yellow-500/50", nameCls: "text-yellow-400", badge: "Coach" },
  parent: { border: "border-blue-500/30",   nameCls: "text-foreground",  badge: null },
  me:     { border: "border-primary",        nameCls: "text-primary",    badge: "You" },
};

function MessageRow({ msg, isMe, senderAvatar, senderInitial, isStaff, user, channelId, channelName, senderRole, onBlock }) {
  const tracked = React.useRef(false);

  React.useEffect(() => {
    if (isMe || tracked.current || !user?.email || !msg.id) return;
    tracked.current = true;
    base44.entities.MessageReadReceipt.filter({ message_id: msg.id, reader_email: user.email })
      .then(existing => {
        if (existing.length === 0) {
          base44.entities.MessageReadReceipt.create({
            message_id: msg.id,
            channel_id: channelId,
            reader_email: user.email,
            reader_name: user.full_name || user.email,
            reader_avatar: user.avatar_url || "",
          });
        }
      });
  }, [msg.id, user?.email, isMe, channelId]);

  const style = isMe ? ROLE_STYLES.me : (ROLE_STYLES[senderRole] || ROLE_STYLES.parent);

  return (
    <div className="flex gap-2.5 group">
      <div className={`w-8 h-8 rounded-full overflow-hidden bg-surface flex items-center justify-center flex-shrink-0 mt-0.5 border ${style.border}`}>
        {senderAvatar
          ? <img src={senderAvatar} alt={msg.sender_name} className="w-full h-full object-cover" />
          : <span className="text-xs font-bold text-primary">{senderInitial}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-sm font-semibold ${style.nameCls}`}>{msg.sender_name || "Unknown"}</span>
          {style.badge && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-surface border border-border text-muted-foreground uppercase tracking-wider">
              {style.badge}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto">
            {msg.created_date ? format(new Date(msg.created_date), "MMM d, h:mm a") : ""}
          </span>
          <MessageActions
            msg={msg}
            currentUser={user}
            channelId={channelId}
            channelName={channelName}
            onBlock={onBlock}
          />
        </div>
        <p className="text-sm text-foreground/80 mt-0.5 break-words">{msg.content}</p>
        {isMe && isStaff && (
          <MessageReadReceipts messageId={msg.id} channelId={channelId} isStaff={isStaff} />
        )}
      </div>
    </div>
  );
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

  const messagesEndRef = useRef(null);
  const messagesScrollRef = useRef(null);
  const inputRef = useRef(null);
  const queryClient = useQueryClient();

  const isTeamChannel = channel === "team";

  // ── Data fetching ─────────────────────────────────────────────────────────
  const { data: messages = [] } = useQuery({
    queryKey: ["messages", channelId],
    queryFn: () => base44.entities.Message.filter({ channel_id: channelId }, "-created_date", 50),
    refetchInterval: 5000,
  });

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

  const sendMutation = useOptimisticMutation(
    (data) => base44.entities.Message.create(data),
    {
      queryClient,
      queryKey: ["messages", channelId],
      updater: (old, newMsg) => [
        ...old,
        { ...newMsg, id: "temp-" + Date.now(), created_date: new Date().toISOString() },
      ],
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ["messages", channelId] }),
    }
  );

  // Scroll to bottom when messages load
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark channel as read when chat view opens
  useEffect(() => {
    if (mobileView === "chat") markChannelRead(channelId);
  }, [mobileView, channelId]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    sendMutation.mutate({
      content: newMessage.trim(),
      channel,
      channel_id: channelId,
      channel_name: channelName,
      sender_name: user?.full_name || "Staff",
      sender_email: user?.email || "",
      sender_avatar: user?.avatar_url || "",
    });
    setNewMessage("");
  };

  const selectChannel = (type, id, name) => {
    setChannel(type);
    setChannelId(id);
    setChannelName(name);
    setMobileView("chat");
    markChannelRead(id);
    setTimeout(() => inputRef.current?.focus(), 150);
  };

  const sortedMessages = [...messages].reverse().filter(m => !allBlockedEmails.has(m.sender_email));
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

  // ── Chat panel (shared mobile + desktop) ─────────────────────────────────
  const ChatPanel = () => (
    <>
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border bg-card flex items-center gap-2 flex-shrink-0 min-h-[48px]">
        {/* Mobile back button */}
        <button
          onClick={() => setMobileView("list")}
          className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors flex-shrink-0"
          aria-label="Back to channels"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <Hash className="w-4 h-4 text-primary flex-shrink-0" />
        <h3 className="font-semibold text-foreground truncate flex-1">{channelName}</h3>
        <div className="flex items-center gap-1 flex-shrink-0">
          {canPostAttendance && (
            <button onClick={() => setShowAttendanceDialog(true)} title="Attendance"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-colors">
              <ClipboardList className="w-4 h-4" />
            </button>
          )}
          <AnnouncementsPanel channel={channel} channelId={channelId} channelName={channelName} sports={sports} teams={teams} />
        </div>
      </div>

      {/* Scrollable messages */}
      <div ref={messagesScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain">


        {sortedMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <MessageSquare className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No messages yet in #{channelName}</p>
            <p className="text-xs text-muted-foreground mt-1">Send the first message</p>
          </div>
        )}

        {sortedMessages.map((msg) => {
          // Event messages with an attendance_request_id render as interactive cards
          if (msg.attendance_request_id) {
            return (
              <div key={msg.id} className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-primary">{(msg.sender_name || "?")[0].toUpperCase()}</span>
                  </div>
                  <span className="text-xs font-semibold text-primary">{msg.sender_name || "Staff"}</span>
                  <span className="text-[10px] text-muted-foreground">{msg.created_date ? format(new Date(msg.created_date), "MMM d, h:mm a") : ""}</span>
                </div>
                <div className="pl-8">
                  <EventMessageCard
                    attendanceRequestId={msg.attendance_request_id}
                    currentUser={user}
                    isStaff={isStaff}
                  />
                </div>
              </div>
            );
          }
          const senderInitial = (msg.sender_name || "?")[0].toUpperCase();
          const isMe = msg.sender_email === user?.email;
          const senderAvatar = isMe ? (user?.avatar_url || msg.sender_avatar) : msg.sender_avatar;
          const isCoachSender = teams.some(t => t.coach_email?.toLowerCase() === msg.sender_email?.toLowerCase());
          const senderRole = isCoachSender ? "coach" : (isStaff ? "staff" : "parent");
          return (
            <MessageRow key={msg.id} msg={msg} isMe={isMe} senderAvatar={senderAvatar}
              senderInitial={senderInitial} isStaff={isStaff} user={user}
              channelId={channelId} channelName={channelName} senderRole={senderRole}
              onBlock={handleBlockUser} />
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Fixed input */}
      <form onSubmit={handleSend} className="flex-shrink-0 px-3 py-3 border-t border-border bg-card safe-area-bottom">
        <div className="flex gap-2 items-center">
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Message #${channelName}…`}
            className="bg-surface border-border text-foreground flex-1"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) handleSend(e); }}
          />
          <Button type="submit" size="icon" disabled={!newMessage.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex-shrink-0 w-10 h-10">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </>
  );

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
        </>
      )}
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <MessagingTermsGate>
    <div className="flex h-[calc(100dvh-4rem)] overflow-hidden">

      {/* ── Desktop sidebar ── */}
      <div className="hidden md:flex flex-col w-64 bg-card border-r border-border flex-shrink-0">
        <div className="flex border-b border-border">
          <button onClick={() => setActiveTab("channels")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${activeTab === "channels" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>
            <Hash className="w-3.5 h-3.5" /> Channels
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
      <div className={`md:hidden flex-1 flex-col bg-background overflow-hidden ${mobileView === "list" ? "flex" : "hidden"}`}>
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
      <div className={`md:hidden flex-1 flex-col overflow-hidden ${mobileView === "chat" ? "flex" : "hidden"}`}>
        {activeTab === "direct"
          ? <DirectMessagePanel currentUser={user} contact={dmContact} isStaff={isStaff} />
          : <ChatPanel />
        }
      </div>

      {/* ── Desktop: chat area ── */}
      <div className="hidden md:flex flex-1 flex-col min-w-0 overflow-hidden">
        {activeTab === "direct"
          ? <DirectMessagePanel currentUser={user} contact={dmContact} isStaff={isStaff} />
          : <ChatPanel />
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