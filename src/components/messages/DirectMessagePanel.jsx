import React, { useState, useRef, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Lock } from "lucide-react";
import { format } from "date-fns";

function makeThreadId(emailA, emailB) {
  return [emailA, emailB].sort().join("__");
}

export default function DirectMessagePanel({ currentUser, contact, isStaff }) {
  const queryClient = useQueryClient();
  const [newMsg, setNewMsg] = useState("");
  const endRef = useRef(null);
  const inputFocused = useRef(false);

  const threadId = currentUser?.email && contact?.email
    ? makeThreadId(currentUser.email, contact.email)
    : null;

  // Use real-time subscription instead of polling to avoid rate-limit pileup
  const [dmMessages, setDmMessages] = useState([]);

  const { data: fetchedDms } = useQuery({
    queryKey: ["dm", threadId],
    queryFn: () => base44.entities.DirectMessage.filter({ thread_id: threadId }, "-created_date", 50),
    enabled: !!threadId,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  // Seed local state from initial fetch
  useEffect(() => {
    if (!fetchedDms) return;
    setDmMessages(fetchedDms);
  }, [fetchedDms]);

  // Reset local state when thread changes
  useEffect(() => {
    setDmMessages([]);
  }, [threadId]);

  // Real-time subscription — no polling
  useEffect(() => {
    if (!threadId) return;
    const unsub = base44.entities.DirectMessage.subscribe((event) => {
      if (event.data?.thread_id !== threadId) return;
      if (event.type === "create") {
        setDmMessages(prev => {
          if (prev.some(m => m.id === event.id)) return prev;
          return [event.data, ...prev];
        });
      } else if (event.type === "delete") {
        setDmMessages(prev => prev.filter(m => m.id !== event.id));
      }
    });
    return () => unsub();
  }, [threadId]);

  const messages = dmMessages;

  const sorted = [...messages].reverse();

  useEffect(() => {
    if (inputFocused.current) return;
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: (data) => base44.entities.DirectMessage.create(data),
    onSuccess: () => {
      setNewMsg("");
    },
  });

  const handleSend = (e) => {
    e.preventDefault();
    if (!newMsg.trim() || !threadId) return;
    // Parents can only reply (not initiate) — but we allow replies
    sendMutation.mutate({
      thread_id: threadId,
      from_email: currentUser.email,
      from_name: currentUser.full_name || currentUser.email,
      from_avatar: currentUser.avatar_url || "",
      to_email: contact.email,
      to_name: contact.name,
      content: newMsg.trim(),
    });
  };

  if (!contact) return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
      Select a conversation
    </div>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="px-4 md:px-6 py-3 border-b border-border bg-card flex items-center gap-3 flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-border text-xs font-bold text-primary">
          {(contact.name || contact.email)[0].toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-foreground text-sm">{contact.name || contact.email}</p>
          <p className="text-xs text-muted-foreground capitalize">{contact.role || "Parent"}</p>
        </div>
        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="w-3 h-3" /> Private
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4"
        onMouseDown={(e) => {
          if (inputFocused.current) e.preventDefault();
        }}
      >
        {sorted.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-10">
            No messages yet. {isStaff ? "Send a message to start the conversation." : "Your coach will message you here."}
          </div>
        )}
        {sorted.map(msg => {
          const isMe = msg.from_email === currentUser?.email;
          return (
            <div key={msg.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary border border-border">
                {(msg.from_name || msg.from_email)[0].toUpperCase()}
              </div>
              <div className={`max-w-[70%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-foreground">{msg.from_name || msg.from_email}</span>
                  <span className="text-xs text-muted-foreground">
                    {msg.created_date ? format(new Date(msg.created_date), "MMM d, h:mm a") : ""}
                  </span>
                </div>
                <div className={`px-4 py-2 rounded-2xl text-sm ${isMe ? "bg-primary text-primary-foreground" : "bg-surface text-foreground border border-border"}`}>
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Input — always visible */}
      <form onSubmit={handleSend} className="p-4 border-t border-border bg-card flex-shrink-0">
        <div className="flex gap-2">
          <Input
              value={newMsg}
              onChange={e => setNewMsg(e.target.value)}
              placeholder={isStaff ? `Message ${contact.name || contact.email}…` : "Message your coach…"}
              className="bg-surface border-border text-foreground"
              onFocus={() => { inputFocused.current = true; }}
              onBlur={() => { inputFocused.current = false; }}
            />
          <Button type="submit" size="icon" className="bg-primary text-primary-foreground flex-shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}