import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { ImagePlus } from "lucide-react";
import { Label } from "@/components/ui/label";

const DEFAULTS = [
  { type: "default_football", emoji: "🏈", label: "Football" },
  { type: "default_baseball", emoji: "🥎", label: "Baseball" },
  { type: "default_cheer", emoji: "📣", label: "Cheer" },
  { type: "default_pom", emoji: "🎀", label: "Pom" },
];

export function getTeamAvatarEmoji(avatarType) {
  const found = DEFAULTS.find(d => d.type === avatarType);
  return found ? found.emoji : "🛡️";
}

export default function TeamAvatarPicker({ avatarUrl, avatarType, onChange }) {
  const [uploading, setUploading] = useState(false);

  const handleDefaultClick = (type) => {
    onChange({ avatar_url: null, avatar_type: type });
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    onChange({ avatar_url: file_url, avatar_type: "custom" });
    setUploading(false);
  };

  const previewEmoji = !avatarUrl && avatarType ? getTeamAvatarEmoji(avatarType) : null;

  return (
    <div className="space-y-2">
      <Label>Team Avatar</Label>
      <div className="flex items-center gap-4">
        {/* Preview */}
        <div className="w-16 h-16 rounded-full overflow-hidden bg-surface border-2 border-border flex items-center justify-center flex-shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Team avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl">{previewEmoji || "🛡️"}</span>
          )}
        </div>

        {/* Options */}
        <div className="flex flex-col gap-2">
          {/* Default icons row */}
          <div className="flex items-center gap-2">
            {DEFAULTS.map(d => (
              <button
                key={d.type}
                type="button"
                onClick={() => handleDefaultClick(d.type)}
                title={d.label}
                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-lg transition-all
                  ${!avatarUrl && avatarType === d.type
                    ? "border-primary bg-primary/10 scale-110"
                    : "border-border bg-surface hover:border-primary/50"}`}
              >
                {d.emoji}
              </button>
            ))}
            {/* Custom upload button */}
            <label
              className={`w-10 h-10 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all
                ${avatarUrl ? "border-primary bg-primary/10 scale-110" : "border-border bg-surface hover:border-primary/50"}`}
              title="Upload custom logo"
            >
              {uploading ? (
                <span className="text-[10px] text-muted-foreground">...</span>
              ) : (
                <ImagePlus className="w-4 h-4 text-muted-foreground" />
              )}
              <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">Pick an icon or upload a logo</p>
        </div>
      </div>
    </div>
  );
}