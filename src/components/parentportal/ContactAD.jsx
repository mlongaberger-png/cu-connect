import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Mail, MessageSquare, ShieldCheck } from "lucide-react";

export default function ContactAD() {
  const { data: admins = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const users = await base44.entities.User.list();
      return users.filter(u => u.role === "admin");
    },
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground p-6">Loading contacts...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-foreground">Contact Athletic Directors</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Reach out to your athletic directors directly via email or Google Chat.
        </p>
      </div>

      {admins.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">No contacts available at this time.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {admins.map(admin => (
            <div key={admin.id} className="bg-card rounded-2xl border border-border p-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{admin.full_name || "Athletic Director"}</p>
                  <p className="text-xs text-primary uppercase tracking-wide">Athletic Director</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{admin.email}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <a
                  href={`mailto:${admin.email}?subject=Parent%20Inquiry`}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <Mail className="w-4 h-4" /> Email
                </a>
                <a
                  href={`https://chat.google.com/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Open Google Chat and search for ${admin.email}`}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-surface text-foreground text-sm font-medium hover:bg-surface-hover transition-colors"
                >
                  <MessageSquare className="w-4 h-4 text-primary" /> Google Chat
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-surface rounded-xl border border-border p-4 text-xs text-muted-foreground">
        <strong className="text-foreground">Note:</strong> For Google Chat, click the button to open Google Chat, then search for the AD's email address to start a direct message.
      </div>
    </div>
  );
}