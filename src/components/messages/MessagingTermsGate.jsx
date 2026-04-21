import React, { useState, useEffect } from "react";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const TERMS_KEY = "cu_messaging_terms_accepted_v1";

export default function MessagingTermsGate({ children }) {
  const [accepted, setAccepted] = useState(null); // null = loading

  useEffect(() => {
    try {
      const stored = localStorage.getItem(TERMS_KEY);
      setAccepted(stored === "true");
    } catch {
      setAccepted(false);
    }
  }, []);

  const handleAccept = () => {
    try { localStorage.setItem(TERMS_KEY, "true"); } catch {}
    setAccepted(true);
  };

  if (accepted === null) return null; // loading
  if (accepted) return children;

  return (
    <div className="flex items-center justify-center h-full p-6">
      <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Messaging Terms</h2>
            <p className="text-xs text-muted-foreground">Before you can send or view messages</p>
          </div>
        </div>

        <div className="bg-surface rounded-xl border border-border p-4 space-y-3 text-sm text-foreground/80 max-h-64 overflow-y-auto">
          <p className="font-semibold text-foreground">Community Messaging Guidelines & EULA</p>
          <p>By accessing messaging features in CU Connect, you agree to the following terms:</p>

          <div className="space-y-2">
            <p className="font-medium text-foreground">✦ Zero Tolerance for Abusive Content</p>
            <p>CU Connect has a <strong>zero-tolerance policy</strong> for objectionable, abusive, harassing, threatening, or inappropriate content of any kind. This includes but is not limited to hate speech, bullying, explicit content, spam, or any content that targets individuals based on race, gender, religion, or other characteristics.</p>

            <p className="font-medium text-foreground">✦ User Conduct</p>
            <p>All messages must be respectful and relevant to team communication. You are solely responsible for the content you send. Misuse of the messaging platform may result in immediate account suspension or removal.</p>

            <p className="font-medium text-foreground">✦ Reporting & Moderation</p>
            <p>You agree to report any objectionable content you encounter using the built-in Flag tool. All reported content is reviewed by administrators within 24 hours. Administrators reserve the right to remove any content and restrict or terminate access for violators.</p>

            <p className="font-medium text-foreground">✦ Blocking</p>
            <p>You may block other users at any time to prevent receiving their messages. Blocking actions are private and not visible to other users.</p>

            <p className="font-medium text-foreground">✦ Privacy</p>
            <p>Messages sent in team channels are visible to all members of that channel including coaches and administrators. Direct messages are private between the two parties.</p>

            <p className="font-medium text-foreground">✦ Agreement</p>
            <p>By tapping "I Agree & Continue", you confirm you have read, understood, and agreed to these messaging terms and the CU Connect Terms of Service.</p>
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
          <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-orange-300">Violations will be acted upon within 24 hours. Repeated violations will result in account suspension.</p>
        </div>

        <Button onClick={handleAccept} className="w-full bg-primary text-primary-foreground font-semibold">
          I Agree &amp; Continue
        </Button>
        <p className="text-center text-xs text-muted-foreground">You must accept to access messaging features.</p>
      </div>
    </div>
  );
}