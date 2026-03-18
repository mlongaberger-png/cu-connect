import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, MessageSquare, Hash } from "lucide-react";
import { format } from "date-fns";

export default function Messages() {
  const [channel, setChannel] = useState("org");
  const [channelId, setChannelId] = useState("org");
  const [channelName, setChannelName] = useState("Organization");
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

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
      {/* Channel Sidebar */}
      <div className="w-64 bg-card border-r border-border flex-shrink-0 overflow-y-auto hidden md:block">
        <div className="p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Channels</h3>
          
          <button
            onClick={() => selectChannel("org", "org", "Organization")}
            className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-1 transition-colors ${channelId === "org" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-surface"}`}
          >
            <Hash className="w-4 h-4" /> Organization
          </button>

          {sports.length > 0 && (
            <>
              <h4 className="text-xs text-muted-foreground uppercase tracking-wider mt-4 mb-2">Sports</h4>
              {sports.map(s => (
                <button
                  key={s.id}
                  onClick={() => selectChannel("sport", s.id, s.name)}
                  className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-1 transition-colors ${channelId === s.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-surface"}`}
                >
                  <Hash className="w-4 h-4" /> {s.name}
                </button>
              ))}
            </>
          )}

          {teams.length > 0 && (
            <>
              <h4 className="text-xs text-muted-foreground uppercase tracking-wider mt-4 mb-2">Teams</h4>
              {teams.map(t => (
                <button
                  key={t.id}
                  onClick={() => selectChannel("team", t.id, t.name)}
                  className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-1 transition-colors ${channelId === t.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-surface"}`}
                >
                  <Hash className="w-4 h-4" /> {t.name}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Channel Header */}
        <div className="px-4 md:px-6 py-3 border-b border-border bg-card flex items-center gap-3">
          <div className="md:hidden">
            <Select value={channelId} onValueChange={(v) => {
              if (v === "org") selectChannel("org", "org", "Organization");
              const sport = sports.find(s => s.id === v);
              if (sport) selectChannel("sport", sport.id, sport.name);
              const team = teams.find(t => t.id === v);
              if (team) selectChannel("team", team.id, team.name);
            }}>
              <SelectTrigger className="w-44 bg-surface border-border"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="org">Organization</SelectItem>
                {sports.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
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
        <form onSubmit={handleSend} className="p-4 border-t border-border bg-card">
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