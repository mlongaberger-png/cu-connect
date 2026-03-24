import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Image, Upload, Trash2, X, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function Gallery() {
  const { user } = useAuth();
  const role = user?.role;
  const isStaff = ["admin", "athletic_director", "coach"].includes(role);
  const isParent = role === "parent" || role === "user";
  const queryClient = useQueryClient();

  const [filterTeam, setFilterTeam] = useState("all");
  const [showUpload, setShowUpload] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [uploadForm, setUploadForm] = useState({ team_id: "", caption: "" });
  const [uploading, setUploading] = useState(false);
  const [filePreview, setFilePreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: () => base44.entities.Team.list(),
  });

  const { data: guardianLinks = [] } = useQuery({
    queryKey: ["guardian-links-gallery"],
    queryFn: () => base44.entities.PlayerGuardian.filter({ user_email: user?.email }),
    enabled: isParent && !!user?.email,
  });

  const { data: myPlayers = [] } = useQuery({
    queryKey: ["my-players-gallery"],
    queryFn: () => base44.entities.Player.list(),
    enabled: isParent,
  });

  // Teams parent can post to (via athlete links)
  const myTeamIds = React.useMemo(() => {
    if (isStaff) return teams.map(t => t.id);
    const linkedPlayerIds = new Set(guardianLinks.map(g => g.player_id));
    const kids = myPlayers.filter(p => linkedPlayerIds.has(p.id) || p.parent_email === user?.email);
    return [...new Set(kids.map(p => p.team_id))];
  }, [isStaff, guardianLinks, myPlayers, user?.email, teams]);

  const allowedTeams = teams.filter(t => myTeamIds.includes(t.id));

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ["photos", filterTeam],
    queryFn: () => filterTeam === "all"
      ? base44.entities.PhotoPost.list("-created_date", 100)
      : base44.entities.PhotoPost.filter({ team_id: filterTeam }, "-created_date", 100),
  });

  // Parents only see photos from their teams
  const visiblePhotos = isStaff
    ? photos
    : photos.filter(p => myTeamIds.includes(p.team_id));

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PhotoPost.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["photos"] }),
  });

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setFilePreview(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!selectedFile || !uploadForm.team_id) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });
      const team = teams.find(t => t.id === uploadForm.team_id);
      await base44.entities.PhotoPost.create({
        team_id: uploadForm.team_id,
        team_name: team?.name || "",
        sport_name: team?.sport_name || "",
        photo_url: file_url,
        caption: uploadForm.caption,
        uploader_name: user?.full_name || user?.email || "",
        uploader_email: user?.email || "",
        uploader_role: isStaff ? "staff" : "parent",
      });
      queryClient.invalidateQueries({ queryKey: ["photos"] });
      setShowUpload(false);
      setUploadForm({ team_id: "", caption: "" });
      setSelectedFile(null);
      setFilePreview(null);
    } finally {
      setUploading(false);
    }
  };

  const canDelete = (photo) => {
    return isStaff || photo.uploader_email === user?.email;
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Photo Gallery</h1>
          <p className="text-sm text-muted-foreground mt-1">{visiblePhotos.length} photos</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filterTeam} onValueChange={setFilterTeam}>
            <SelectTrigger className="w-44 bg-surface border-border"><SelectValue placeholder="All Teams" /></SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">All Teams</SelectItem>
              {(isStaff ? teams : allowedTeams).map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {allowedTeams.length > 0 && (
            <Button onClick={() => setShowUpload(true)} className="bg-primary text-primary-foreground">
              <Upload className="w-4 h-4 mr-2" /> Upload Photo
            </Button>
          )}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-square bg-card rounded-xl animate-pulse border border-border" />
          ))}
        </div>
      ) : visiblePhotos.length === 0 ? (
        <div className="text-center py-24 bg-card rounded-2xl border border-border">
          <Image className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground">No photos yet</h3>
          <p className="text-muted-foreground text-sm mt-1">
            {allowedTeams.length === 0 ? "You don't have any linked athletes yet." : "Be the first to upload a photo!"}
          </p>
        </div>
      ) : (
        <div className="columns-2 sm:columns-3 md:columns-4 gap-3 space-y-3">
          {visiblePhotos.map(photo => (
            <div
              key={photo.id}
              className="relative group rounded-xl overflow-hidden bg-card border border-border cursor-pointer break-inside-avoid mb-3"
              onClick={() => setLightbox(photo)}
            >
              <img
                src={photo.photo_url}
                alt={photo.caption || "Team photo"}
                className="w-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
              <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {photo.caption && <p className="text-xs text-white font-medium truncate">{photo.caption}</p>}
                <p className="text-[10px] text-white/70">{photo.team_name}</p>
              </div>
              {canDelete(photo) && (
                <button
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 p-1 rounded-lg hover:bg-red-500/80"
                  onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(photo.id); }}
                >
                  <Trash2 className="w-3.5 h-3.5 text-white" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="bg-card border-border text-foreground max-w-md">
          <DialogHeader><DialogTitle>Upload Photo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => document.getElementById("photo-upload-input").click()}
            >
              {filePreview ? (
                <img src={filePreview} alt="Preview" className="max-h-48 mx-auto rounded-lg object-contain" />
              ) : (
                <>
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Click to select a photo</p>
                </>
              )}
              <input id="photo-upload-input" type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
            </div>

            <Select value={uploadForm.team_id} onValueChange={v => setUploadForm(f => ({ ...f, team_id: v }))}>
              <SelectTrigger className="bg-surface border-border"><SelectValue placeholder="Select team…" /></SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {allowedTeams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Textarea
              placeholder="Add a caption… (optional)"
              value={uploadForm.caption}
              onChange={e => setUploadForm(f => ({ ...f, caption: e.target.value }))}
              className="bg-surface border-border"
              rows={2}
            />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowUpload(false)} className="border-border">Cancel</Button>
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || !uploadForm.team_id || uploading}
                className="bg-primary text-primary-foreground"
              >
                {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading…</> : "Upload"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button className="absolute top-4 right-4 text-white hover:text-primary" onClick={() => setLightbox(null)}>
            <X className="w-6 h-6" />
          </button>
          <div className="max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <img src={lightbox.photo_url} alt={lightbox.caption} className="w-full max-h-[75vh] object-contain rounded-xl" />
            <div className="mt-3 text-center">
              {lightbox.caption && <p className="text-white font-medium">{lightbox.caption}</p>}
              <p className="text-white/60 text-sm mt-1">
                {lightbox.team_name} · {lightbox.uploader_name}
                {lightbox.created_date ? ` · ${format(new Date(lightbox.created_date), "MMM d, yyyy")}` : ""}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}