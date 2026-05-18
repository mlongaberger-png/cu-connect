import React from "react";
import { Megaphone, Pin, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const priorityStyles = {
  normal: "border-border",
  important: "border-primary/40",
  urgent: "border-red-500/40",
};

export default function RecentAnnouncements({ announcements }) {
  if (!announcements || announcements.length === 0) {
    return (
      <div className="relative overflow-hidden bg-card/80 backdrop-blur-sm rounded-2xl border border-border p-6">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <h3 className="text-lg font-semibold text-foreground mb-4">Announcements</h3>
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Megaphone className="w-7 h-7 text-primary/60" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No announcements yet</p>
          <p className="text-xs text-muted-foreground/60">New announcements will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-card/80 backdrop-blur-sm rounded-2xl border border-border p-6">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <h3 className="text-lg font-semibold text-foreground mb-4">Announcements</h3>
      <div className="space-y-3">
        {announcements.slice(0, 4).map((ann) => (
          <div 
            key={ann.id} 
            className={`p-4 rounded-xl bg-surface border ${priorityStyles[ann.priority] || priorityStyles.normal}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {ann.priority === "urgent" && <AlertTriangle className="w-4 h-4 text-red-400" />}
                  {ann.is_pinned && <Pin className="w-3 h-3 text-primary" />}
                  <h4 className="text-sm font-semibold text-foreground truncate">{ann.title}</h4>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{ann.content}</p>
                <div className="flex items-center gap-2 mt-2">
                  {ann.target_name && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {ann.target_name}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {ann.created_date ? format(new Date(ann.created_date), "MMM d") : ""}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}