import React from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MessageSquare, Shield, Hash } from "lucide-react";

export default function ChatSidebar({ activeChannelId }) {
  const [, setSearchParams] = useSearchParams();

  const { data: teamChannels = [] } = useQuery({
    queryKey: ["channels", "team"],
    queryFn: () => base44.entities.Channel.filter({ type: "team" }),
  });

  const { data: directChannels = [] } = useQuery({
    queryKey: ["channels", "direct"],
    queryFn: () => base44.entities.Channel.filter({ type: "direct" }),
  });

  const handleSelect = (channelId) => {
    setSearchParams({ channelId });
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="p-4 border-b border-border shrink-0">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          Messages
        </h2>
      </div>

      <Tabs defaultValue="teams" className="flex flex-col flex-1 overflow-hidden">
        <TabsList className="mx-3 mt-3 shrink-0">
          <TabsTrigger value="teams" className="flex-1 text-xs">🛡️ Teams</TabsTrigger>
          <TabsTrigger value="direct" className="flex-1 text-xs">💬 Direct</TabsTrigger>
        </TabsList>

        {/* Teams */}
        <TabsContent value="teams" className="flex-1 overflow-y-auto mt-0 px-2 py-2">
          {teamChannels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <Shield className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No team channels yet</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {teamChannels.map((channel) => {
                const isActive = channel.id === activeChannelId;
                return (
                  <button
                    key={channel.id}
                    onClick={() => handleSelect(channel.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition-all
                      ${isActive ? "bg-primary/15 text-primary" : "text-foreground hover:bg-surface-hover"}`}
                  >
                    {channel.avatar_url ? (
                      <img src={channel.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <Hash className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <span className="truncate font-medium">{channel.name || "Unnamed Channel"}</span>
                  </button>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Direct */}
        <TabsContent value="direct" className="flex-1 overflow-y-auto mt-0 px-2 py-2">
          {directChannels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <MessageSquare className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No direct messages yet</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {directChannels.map((channel) => {
                const isActive = channel.id === activeChannelId;
                const members = (() => {
                  try { return JSON.parse(channel.member_emails || "[]"); } catch { return []; }
                })();
                const label = members.length > 0 ? members.join(", ") : "Direct Message";
                return (
                  <button
                    key={channel.id}
                    onClick={() => handleSelect(channel.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition-all
                      ${isActive ? "bg-primary/15 text-primary" : "text-foreground hover:bg-surface-hover"}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground">
                      {(members[0]?.[0] || "?").toUpperCase()}
                    </div>
                    <span className="truncate font-medium">{label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}