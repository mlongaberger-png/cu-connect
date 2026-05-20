import { useState, useEffect } from "react";
import { X, Share, Plus } from "lucide-react";

// Detects iPhone/iPad Safari (not already installed as PWA)
function isIOSSafariNotInstalled() {
  const ua = window.navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/crios|fxios|opios/i.test(ua);
  const isStandalone = window.navigator.standalone === true;
  return isIOS && isSafari && !isStandalone;
}

const STORAGE_KEY = "ios_install_banner_dismissed";

export default function IOSInstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isIOSSafariNotInstalled()) return;
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) setShow(true);
  }, []);

  if (!show) return null;

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  };

  return (
    <div className="fixed bottom-20 left-3 right-3 z-50 bg-card border border-border rounded-2xl shadow-2xl p-4 flex items-start gap-3 animate-in slide-in-from-bottom-4">
      {/* App icon */}
      <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
        <span className="text-xl">🏆</span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Install CU Connect</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          Add to your Home Screen to enable push notifications and get game alerts!
        </p>
        <div className="flex items-center gap-1.5 mt-2 text-xs text-primary font-medium">
          <span>Tap</span>
          <span className="inline-flex items-center gap-0.5 bg-primary/10 rounded px-1.5 py-0.5">
            <Share className="w-3 h-3" /> Share
          </span>
          <span>then</span>
          <span className="inline-flex items-center gap-0.5 bg-primary/10 rounded px-1.5 py-0.5">
            <Plus className="w-3 h-3" /> Add to Home Screen
          </span>
        </div>
      </div>

      <button
        onClick={handleDismiss}
        className="text-muted-foreground hover:text-foreground p-1 shrink-0 -mt-0.5"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}