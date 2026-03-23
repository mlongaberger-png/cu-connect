import React, { useRef, useState } from "react";
import { Trophy, Shield, Camera, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";

export default function AthleteCard({ player, team, sport, canEdit = false }) {
  const initials = `${player.first_name?.[0] || ""}${player.last_name?.[0] || ""}`.toUpperCase();
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(player.photo_url || "");
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.Player.update(player.id, { photo_url: file_url });
    setPhotoUrl(file_url);
    queryClient.invalidateQueries({ queryKey: ["players"] });
    setUploading(false);
  };

  return (
    <div className="relative w-64 rounded-3xl overflow-hidden shadow-2xl border border-primary/30 bg-gradient-to-b from-card via-card to-background select-none">
      {/* Top accent bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

      {/* Header strip */}
      <div className="bg-gradient-to-br from-primary/20 to-transparent px-5 pt-4 pb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
            {sport?.name || team?.sport_name || "Athletics"}
          </p>
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground mt-0.5">
            {team?.name || "Team"}
          </p>
        </div>
        <Shield className="w-6 h-6 text-primary/40" />
      </div>

      {/* Photo area */}
      <div className="flex justify-center px-5 pb-3">
        <div className="relative w-28 h-28 rounded-2xl overflow-hidden border-2 border-primary/40 shadow-lg bg-surface group">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={`${player.first_name} ${player.last_name}`}
              className="w-full h-full object-cover object-top"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/30">
              <span className="text-3xl font-black text-primary">{initials}</span>
            </div>
          )}
          {/* Jersey number overlay */}
          {player.jersey_number && (
            <div className="absolute bottom-1 right-1 bg-primary text-primary-foreground text-xs font-black rounded-md px-1.5 py-0.5 leading-none shadow">
              #{player.jersey_number}
            </div>
          )}
          {/* Upload overlay (only when canEdit) */}
          {canEdit && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 cursor-pointer"
            >
              {uploading
                ? <Loader2 className="w-5 h-5 text-white animate-spin" />
                : <Camera className="w-5 h-5 text-white" />
              }
              {!uploading && <span className="text-[10px] text-white font-semibold">Upload</span>}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoUpload}
          />
        </div>
      </div>

      {/* Name + position */}
      <div className="text-center px-4 pb-3">
        <h3 className="text-lg font-black text-foreground leading-tight tracking-tight">
          {player.first_name?.toUpperCase()}
        </h3>
        <h3 className="text-xl font-black text-primary leading-tight tracking-tight -mt-0.5">
          {player.last_name?.toUpperCase()}
        </h3>
        {player.position && (
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mt-1">
            {player.position}
          </p>
        )}
      </div>

      {/* Stats strip */}
      <div className="mx-4 mb-4 rounded-xl bg-surface border border-border p-3 flex items-center justify-around">
        <div className="text-center">
          <p className="text-xs font-bold text-primary">{player.jersey_number || "—"}</p>
          <p className="text-[9px] uppercase text-muted-foreground tracking-wider mt-0.5">Jersey</p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="text-center">
          <p className="text-xs font-bold text-foreground capitalize">{team?.age_group || "—"}</p>
          <p className="text-[9px] uppercase text-muted-foreground tracking-wider mt-0.5">Division</p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="text-center">
          <p className="text-xs font-bold text-foreground capitalize">{team?.season || "—"}</p>
          <p className="text-[9px] uppercase text-muted-foreground tracking-wider mt-0.5">Season</p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center gap-1.5 pb-4">
        <Trophy className="w-3 h-3 text-primary/60" />
        <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
          Cornerstone United Athletics
        </p>
      </div>

      {/* Bottom accent */}
      <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
    </div>
  );
}