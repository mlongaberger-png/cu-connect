import React from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/lib/AuthContext";
import { Plus, Hash, MessageSquare, Car, Megaphone, Crown } from "lucide-react";

export default function ChatSidebar({ activeChannelId }) {
  const [, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isStaff = ["admin", "athletic_director"].includes(user?.role);

  const { data: teamChannels = [] } = useQuery({
    queryKey: ["channels", "team"],
    queryFn: () => base44.entities.Channel.filter({ type: "team" }),
  });

  const { data: directChannels = [] } = useQuery({
    queryKey: ["channels", "direct"],
    queryFn: () => base44.entities.Channel.filter({ type: "direct" }),
  });

  const { data: carpoolChannels = [] } = useQuery({
    queryKey: ["channels", "carpool"],
    queryFn: () => base44.entities.Channel.filter({ type: "carpool" }),
  });

  const { data: announceChannels = [] } = useQuery({
    queryKey: ["channels", "announcement"],
    queryFn: () => base44.entities.Channel.filter({ type: "announcement" }),
  });

  const select = (id) => setSearchParams({ channelId: id });

  const ChannelBtn = ({ ch, pinned }) => {
    const isActive = ch.id === activeChannelId;
    return (
      <button
        onClick={() => select(ch.id)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors
          ${isActive ? "bg-primary/15 text-primary font-medium" : "hover:bg-surface text-muted-foreground"}
          ${pinned ? "border border-yellow-500/30 bg-yellow-500/5" : ""}`}
      >
        {ch.avatar_url ? (
          <img src={ch.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            {pinned ? <Crown className="w-3.5 h-3.5 text-yellow-400" /> : <Hash className="w-3.5 h-3.5 text-primary" />}
          </div>
        )}
        <span className="truncate text-sm">{ch.name || "Unnamed"}</span>
        {pinned && <Crown className="w-3 h-3 text-yellow-400 ml-auto shrink-0" />}
      </button>
    );
  };

  const EmptyTab = ({ icon: IconComp, label }) => (
    <div className="flex flex-col items-center justify-center py-10 gap-2">
      <IconComp className="w-7 h-7 text-muted-foreground" />
      <p className="text-xs text-muted-foreground">No {label} yet</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" /> Messages
        </h2>
        {isStaff && (
          <button className="p-1.5 rounded-lg hover:bg-surface transition-colors text-muted-foreground hover:text-foreground">
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="teams" className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-4 p-2 bg-muted mx-0 rounded-none border-b border-border">
          <TabsTrigger value="teams" className="text-xs px-1">🛡️ Teams</TabsTrigger>
          <TabsTrigger value="direct" className="text-xs px-1">💬 DMs</TabsTrigger>
          <TabsTrigger value="carpool" className="text-xs px-1">🚗 Rides</TabsTrigger>
          <TabsTrigger value="announce" className="text-xs px-1">📢 News</TabsTrigger>
        </TabsList>

        <TabsContent value="teams" className="flex-1 overflow-y-auto p-2 space-y-1 mt-0">
          {teamChannels.length === 0
            ? <EmptyTab icon={Hash} label="team channels" />
            : teamChannels.map(ch => <ChannelBtn key={ch.id} ch={ch} />)}
        </TabsContent>

        <TabsContent value="direct" className="flex-1 overflow-y-auto p-2 space-y-1 mt-0">
          {directChannels.length === 0
            ? <EmptyTab icon={MessageSquare} label="direct messages" />
            : [...directChannels]
                .sort((a, b) => (b.pinned_role ? 1 : 0) - (a.pinned_role ? 1 : 0))
                .map(ch => <ChannelBtn key={ch.id} ch={ch} pinned={!!ch.pinned_role} />)}
        </TabsContent>

        <TabsContent value="carpool" className="flex-1 overflow-y-auto p-2 space-y-1 mt-0">
          {carpoolChannels.length === 0
            ? <EmptyTab icon={Car} label="carpool channels" />
            : carpoolChannels.map(ch => <ChannelBtn key={ch.id} ch={ch} />)}
        </TabsContent>

        <TabsContent value="announce" className="flex-1 overflow-y-auto p-2 space-y-1 mt-0">
          {announceChannels.length === 0
            ? <EmptyTab icon={Megaphone} label="announcements" />
            : announceChannels.map(ch => <ChannelBtn key={ch.id} ch={ch} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}