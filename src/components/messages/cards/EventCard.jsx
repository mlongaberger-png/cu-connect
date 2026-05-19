import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/AuthContext";
import { CalendarDays, MapPin } from "lucide-react";

const REACTIONS = [
  { type: "going", emoji: "👍", label: "Going" },
  { type: "not_going", emoji: "🤒", label: "Can't Go" },
  { type: "need_ride", emoji: "🚗", label: "Need Ride" },
];

export default function EventCard({ msg }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const meta = (() => {
    try { return JSON.parse(msg.metadata || "{}"); } catch { return {}; }
  })();

  const reactionMutation = useMutation({
    mutationFn: (reactionType) =>
      base44.entities.MessageReaction.create({
        message_id: msg.id,
        user_id: user?.id || user?.email,
        user_email: user?.email,
        reaction_type: reactionType,
      }),
    onMutate: async (reactionType) => {
      const qk = ["messages", msg.channel_id];
      await queryClient.cancelQueries({ queryKey: qk });
      const prev = queryClient.getQueryData(qk);
      queryClient.setQueryData(qk, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) =>
            page.map((m) => {
              if (m.id !== msg.id) return m;
              const reactions = { ...(m._reactions || {}) };
              reactions[reactionType] = (reactions[reactionType] || 0) + 1;
              return { ...m, _reactions: reactions };
            })
          ),
        };
      });
      return { prev };
    },
    onError: (err, vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["messages", msg.channel_id], ctx.prev);
    },
  });

  return (
    <Card className="w-full max-w-sm bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-4 space-y-2">
        <p className="font-bold text-foreground text-sm">{meta.title || "Event"}</p>
        {meta.date && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="w-3.5 h-3.5" /> {meta.date}
          </div>
        )}
        {meta.location && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="w-3.5 h-3.5" /> {meta.location}
          </div>
        )}
      </div>
      <div className="border-t border-border flex justify-between p-2">
        {REACTIONS.map(({ type, emoji, label }) => (
          <button
            key={type}
            onClick={() => reactionMutation.mutate(type)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-surface transition-colors text-xs text-muted-foreground hover:text-foreground"
          >
            <span>{emoji}</span>
            <span>{label}</span>
            {msg._reactions?.[type] > 0 && (
              <span className="ml-1 text-primary font-semibold">{msg._reactions[type]}</span>
            )}
          </button>
        ))}
      </div>
    </Card>
  );
}