import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Hash, MessageSquare, Car, Crown, MessageSquarePlus } from "lucide-react";
import { getTeamAvatarEmoji } from "@/components/teams/TeamAvatarPicker";
import NewDmDialog from "@/components/messages/NewDmDialog";
import CarpoolRequestModal from "@/components/carpool/CarpoolRequestModal";

export default function ChatSidebar({ activeChannelId }) {
  const [, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [showNewDm, setShowNewDm] = useState(false);
  const [showCarpoolRequest, setShowCarpoolRequest] = useState(false);
  const [newChannelForm, setNewChannelForm] = useState({ name: "", type: "team", team_id: "" });

  const { data: currentUser } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  // PROTECTED: Optional chaining ensures no TypeError if currentUser is null
  const canCreate = currentUser?.role === "admin" || currentUser?.role === "athletic_director";

  const { data: orgTeams = [] } = useQuery({
    queryKey: ["org-teams"],
    queryFn: () => base44.entities.Team.list(),
    enabled: !!currentUser,
  });

  // ... (Keep your teamChannels, directChannels, carpoolChannels, announceChannels queries here) ...

  return (
    // FIX: Added 'h-full flex flex-col' to ensure the component fills the parent sidebar
    <Tabs defaultValue="teams" className="h-full flex flex-col bg-card overflow-hidden">
      
      {/* FIX: Solid Header Unit - Absolute layering prevents scroll bleeding */}
      <div className="flex-shrink-0 border-b border-border bg-card z-20 shadow-sm">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" /> Messages
          </h2>
          {canCreate && (
            <Button variant="ghost" size="icon" onClick={() => setShowCreate(true)}>
              <Plus className="w-5 h-5" />
            </Button>
          )}
        </div>
        <div className="px-4 pb-3">
          <TabsList className="grid w-full grid-cols-4 bg-muted">
            <TabsTrigger value="teams">🛡️ Teams</TabsTrigger>
            <TabsTrigger value="direct">💬 Direct</TabsTrigger>
            <TabsTrigger value="carpool">🚗</TabsTrigger>
            <TabsTrigger value="announce">📢 News</TabsTrigger>
          </TabsList>
        </div>
      </div>

      {/* FIX: Explicit flex-1 with overflow-y-auto ensures the list scrolls inside the container */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <TabsContent value="teams" className="m-0 space-y-1">
          {teamChannels.map(ch => <ChannelBtn key={ch.id} ch={ch} />)}
        </TabsContent>
        {/* ... rest of your TabsContent ... */}
      </div>

      {/* Modals remain outside the layout flow */}
      <CarpoolRequestModal open={showCarpoolRequest} onOpenChange={setShowCarpoolRequest} currentUser={currentUser} />
      <NewDmDialog open={showNewDm} onOpenChange={setShowNewDm} currentUser={currentUser} />
    </Tabs>
  );
}
