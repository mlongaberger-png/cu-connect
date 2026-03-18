import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageSquare, Hash } from "lucide-react";
import { format } from "date-fns";
import MessagesSidebar from "@/components/messages/MessagesSidebar";
import MobileChannelPicker from "@/components/messages/MobileChannelPicker";

export default function Messages() {
  const [channel, setChannel] = useState("org");
  const [channelId, setChannelId] = useState("org");
  const [channelName, setChannelName] = useState("Organization");
  const [newMessage, setNewMessage] = useState("");
  const [userId, setUserId] = useState(null);
  const [starredIds, setStarredIds] = useState([]);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      if (!u) return;
      setUserId(u.id);
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

  const { data: sports = [] } = useQuery({
    queryKey: ["sports"],
    queryFn: () => base44.entities.Sport.list(),
  });
  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const sendMutation = useMutation({
    mutationFn: (data) => base44.entities.Message.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
      setNewMessage("");
    },
  });

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
      sender_name: "Admin",
    });
  };

  const selectChannel = (type, id, name) => {
    setChannel(type);
    setChannelId(id);
    setChannelName(name);
  };

  const sortedMessages = [...messages].reverse();

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar — desktop only */}
      <MessagesSidebar
        channelId={channelId}
        onSelectChannel={selectChannel}
        sports={sports}
        teams={teams}
      />

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Channel Header */}
        <div className="px-4 md:px-6 py-3 border-b border-border bg-card flex items-center gap-3 flex-shrink-0">
          {/* Mobile picker */}
          <div className="md:hidden">
            <MobileChannelPicker
              sports={sports}
              teams={teams}
              channelId={channelId}
              onSelectChannel={selectChannel}
              starredIds={starredIds}
            />
          </div>
          {/* Desktop title */}
          <div className="hidden md:block">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Hash className="w-4 h-4 text-primary" /> {channelName}
            </h3>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {sortedMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageSquare className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No messages yet in #{channelName}</p>
              <p className="text-xs text-muted-foreground mt-1">Send the first message</p>
            </div>
          )}
          {sortedMessages.map((msg) => (
            <div key={msg.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-primary">{(msg.sender_name || "?")[0]}</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{msg.sender_name || "Unknown"}</span>
                  <span className="text-xs text-muted-foreground">
                    {msg.created_date ? format(new Date(msg.created_date), "MMM d, h:mm a") : ""}
                  </span>
                </div>
                <p className="text-sm text-foreground/80 mt-0.5">{msg.content}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-4 border-t border-border bg-card flex-shrink-0">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`Message #${channelName}...`}
              className="bg-surface border-border text-foreground"
            />
            <Button type="submit" size="icon" className="bg-primary text-primary-foreground hover:bg-primary/90 flex-shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}