import React, { useState, useRef, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageSquare, Hash, ClipboardList, MessagesSquare, Settings2, X, ChevronRight } from "lucide-react";
import MessageRoomManager from "@/components/messages/MessageRoomManager";
import DirectMessagePanel from "@/components/messages/DirectMessagePanel";
import { format } from "date-fns";
import MessagesSidebar from "@/components/messages/MessagesSidebar";
import AnnouncementsPanel from "@/components/messages/AnnouncementsPanel";
import AttendanceCard from "@/components/attendance/AttendanceCard";
import CreateAttendanceDialog from "@/components/attendance/CreateAttendanceDialog";
import MessageReadReceipts from "@/components/messages/MessageReadReceipts";
import { useAuth } from "@/lib/AuthContext";

const ROLE_STYLES = {
  staff: { border: "border-primary/50", nameCls: "text-primary", badge: "Staff" },
  coach: { border: "border-yellow-500/50", nameCls: "text-yellow-400", badge: "Coach" },
  parent: { border: "border-blue-500/30", nameCls: "text-foreground", badge: null },
  me: { border: "border-primary", nameCls: "text-primary", badge: "You" },
};

function MessageRow({ msg, isMe, senderAvatar, senderInitial, isStaff, user, channelId, senderRole }) {
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
    <div className="flex gap-2.5">
      <div className={`w-8 h-8 rounded-full overflow-hidden bg-surface flex items-center justify-center flex-shrink-0 mt-0.5 border ${style.border}`}>
        {senderAvatar
          ? <img src={senderAvatar} alt={msg.sender_name} className="w-full h-full object-cover" />
          : <span className="text-xs font-bold text-primary">{senderInitial}</span>
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className={`text-sm font-semibold ${style.nameCls}`}>{msg.sender_name || "Unknown"}</span>
          {style.badge && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-surface border border-border text-muted-foreground uppercase tracking-wider">{style.badge}</span>}
          <span className="text-[10px] text-muted-foreground ml-auto">
            {msg.created_date ? format(new Date(msg.created_date), "MMM d, h:mm a") : ""}
          </span>
        </div>
        <p className="text-sm text-foreground/80 mt-0.5 break-words">{msg.content}</p>
        {isMe && isStaff && (
          <MessageReadReceipts messageId={msg.id} channelId={channelId} isStaff={isStaff} />
        )}
      </div>
    </div>
  );
}

export default function Messages() {
  const { user } = useAuth();
  const role = user?.role;
  const isStaff = ["admin", "athletic_director", "coach"].includes(role);
  const isParent = role === "parent" || role === "user";

  const [channel, setChannel] = useState("org");
  const [channelId, setChannelId] = useState("org");
  const [channelName, setChannelName] = useState("Organization");
  const [parentChannelReady, setParentChannelReady] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [starredIds, setStarredIds] = useState([]);
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("channels");
  const [dmContact, setDmContact] = useState(null);
  const [showMobileChannels, setShowMobileChannels] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesScrollRef = useRef(null);
  const inputRef = useRef(null);
  const queryClient = useQueryClient();

  const isTeamChannel = channel === "team";

  useEffect(() => {
    base44.auth.me().then(u => {
      if (!u) return;
      base44.entities.UserChatPreference.filter({ user_id: u.id, is_starred: true }).then(prefs => {
        setStarredIds(prefs.map(p => p.chat_id));
      });
    }).catch(() => {});
  }, []);

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", channelId],
    queryFn: () => base44.entities.Message.filter({ channel_id: channelId }, "-created_date", 50),
    refetchInterval: 5000,
  });

  const { data: sports = [] } = useQuery({ queryKey: ["sports"], queryFn: () => base44.entities.Sport.list() });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => base44.entities.Team.list() });
  const { data: allPlayers = [] } = useQuery({ queryKey: ["players"], queryFn: () => base44.entities.Player.list() });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["all-users-dm"],
    queryFn: () => base44.entities.User.list(),
    enabled: isStaff,
  });
  const parentUsers = allUsers.filter(u => ["parent", "user"].includes(u.role));

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

  const { data: attendanceRequests = [] } = useQuery({
    queryKey: ["attendance-requests", channelId],
    queryFn: () => base44.entities.AttendanceRequest.filter({ channel_id: channelId }, "-created_date", 10),
    enabled: isTeamChannel,
    refetchInterval: 10000,
  });

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    setShowMobileChannels(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const sortedMessages = [...messages].reverse();
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

  return (
    <div className="flex h-[calc(100dvh-4rem)] overflow-hidden">

      {/* ── Desktop Sidebar ── */}
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

        {activeTab === "channels" ? (
          <MessagesSidebar
            channelId={channelId}
            onSelectChannel={selectChannel}
            sports={sports}
            teams={teams}
            userRole={role}
            userEmail={user?.email}
            filterTeamIds={myFilterTeamIds}
          />
        ) : activeTab === "rooms" ? (
          <div className="flex-1 overflow-y-auto"><MessageRoomManager currentUser={user} /></div>
        ) : (
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
        )}
      </div>

      {/* ── Chat Area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {activeTab === "direct" ? (
          <DirectMessagePanel currentUser={user} contact={dmContact} isStaff={isStaff} />
        ) : (
          <>
            {/* Header */}
            <div className="px-3 py-2.5 border-b border-border bg-card flex items-center gap-2 flex-shrink-0 min-h-[48px]">
              {/* Mobile: channel button */}
              <button
                onClick={() => setShowMobileChannels(true)}
                className="md:hidden flex items-center gap-1.5 min-w-0 flex-1 text-left"
              >
                <Hash className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="font-semibold text-foreground text-sm truncate">{channelName}</span>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 rotate-90" />
              </button>

              {/* Desktop: static channel name */}
              <div className="hidden md:flex items-center gap-2 flex-1 min-w-0">
                <Hash className="w-4 h-4 text-primary flex-shrink-0" />
                <h3 className="font-semibold text-foreground truncate">{channelName}</h3>
              </div>

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

            {/* Messages — scrollable area */}
            <div ref={messagesScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain">
              {isTeamChannel && attendanceRequests.length > 0 && (
                <div className="space-y-3 pb-2 border-b border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5 text-primary" /> Attendance
                  </p>
                  {attendanceRequests.map(req => (
                    <AttendanceCard key={req.id} request={req} isStaff={isStaff} currentUser={user} myPlayers={[]} allPlayers={allPlayers} />
                  ))}
                </div>
              )}

              {sortedMessages.length === 0 && attendanceRequests.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center py-16">
                  <MessageSquare className="w-12 h-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No messages yet in #{channelName}</p>
                  <p className="text-xs text-muted-foreground mt-1">Send the first message</p>
                </div>
              )}

              {sortedMessages.map((msg) => {
                const senderInitial = (msg.sender_name || "?")[0].toUpperCase();
                const isMe = msg.sender_email === user?.email;
                const senderAvatar = isMe ? (user?.avatar_url || msg.sender_avatar) : msg.sender_avatar;
                const isCoachSender = teams.some(t => t.coach_email?.toLowerCase() === msg.sender_email?.toLowerCase());
                const senderRole = isCoachSender ? "coach" : (isStaff ? "staff" : "parent");
                return (
                  <MessageRow key={msg.id} msg={msg} isMe={isMe} senderAvatar={senderAvatar}
                    senderInitial={senderInitial} isStaff={isStaff} user={user}
                    channelId={channelId} senderRole={senderRole} />
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Fixed input bar */}
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
        )}
      </div>

      {/* ── Mobile Channel Sheet (bottom slide-in) ── */}
      {showMobileChannels && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowMobileChannels(false)} />
          {/* Sheet */}
          <div className="relative bg-card border-t border-border rounded-t-2xl max-h-[70vh] flex flex-col z-10">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <p className="font-semibold text-foreground text-sm">Channels</p>
              <button onClick={() => setShowMobileChannels(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <MessagesSidebar
                channelId={channelId}
                onSelectChannel={selectChannel}
                sports={sports}
                teams={teams}
                userRole={role}
                userEmail={user?.email}
                filterTeamIds={myFilterTeamIds}
              />
            </div>
          </div>
        </div>
      )}

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
  );
}