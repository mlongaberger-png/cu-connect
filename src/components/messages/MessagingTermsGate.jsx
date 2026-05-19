import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";

const STORAGE_KEY = "cu_messaging_terms_accepted";

export default function MessagingTermsGate({ children }) {
  const [accepted, setAccepted] = useState(() => localStorage.getItem(STORAGE_KEY) === "true");

  const handleAccept = async () => {
    localStorage.setItem(STORAGE_KEY, "true");
    try {
      const user = await base44.auth.me();
      if (user) await base44.auth.updateMe({ messaging_terms_accepted: true });
    } catch {}
    setAccepted(true);
  };

  if (accepted) return children;

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full items-center justify-center bg-background px-6">
      <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
          <MessageSquare className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-lg font-bold text-foreground">Community Messaging</h2>
        <p className="text-sm text-muted-foreground">
          By using CU Connect messaging you agree to communicate respectfully. Messages may be reviewed by administrators.
        </p>
        <Button onClick={handleAccept} className="w-full">I Agree — Open Messages</Button>
      </div>
    </div>
  );
}