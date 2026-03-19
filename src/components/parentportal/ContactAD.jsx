import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Mail, MessageSquare, ShieldCheck, Phone } from "lucide-react";

export default function ContactAD({ sportIds = [] }) {
  const { data: ads = [], isLoading } = useQuery({
    queryKey: ["athletic-directors"],
    queryFn: () => base44.entities.AthleticDirector.list(),
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground p-6">Loading contacts...</div>;
  }

  // Show only ADs linked to the parent's sports, or ADs with no sport (org-wide)
  const filteredAds = sportIds.length > 0
    ? ads.filter(ad => !ad.sport_id || sportIds.includes(ad.sport_id))
    : ads;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-foreground">Contact Athletic Directors</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Reach out to your athletic directors directly via email or Google Chat.
        </p>
      </div>

      {filteredAds.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">No contacts available at this time.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ads.map(ad => (
            <div key={ad.id} className="bg-card rounded-2xl border border-border p-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{ad.name}</p>
                  <p className="text-xs text-primary uppercase tracking-wide">{ad.title || "Athletic Director"}</p>
                  {ad.sport_name && <p className="text-xs text-muted-foreground mt-0.5">{ad.sport_name}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">{ad.email}</p>
                  {ad.phone && <p className="text-xs text-muted-foreground">{ad.phone}</p>}
                </div>
              </div>

              <div className="flex gap-2">
                <a
                  href={`mailto:${ad.email}?subject=Parent%20Inquiry`}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <Mail className="w-4 h-4" /> Email
                </a>
                {ad.google_chat_url && (
                  <a
                    href={ad.google_chat_url.startsWith("http") ? ad.google_chat_url : `https://chat.google.com/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-surface text-foreground text-sm font-medium hover:bg-surface-hover transition-colors"
                  >
                    <MessageSquare className="w-4 h-4 text-primary" /> Google Chat
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}