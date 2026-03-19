import React, { useState, useEffect } from "react";
import { WifiOff, Wifi } from "lucide-react";

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      setTimeout(() => setShowRestored(false), 3000);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline && !showRestored) return null;

  return (
    <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg border text-sm font-medium transition-all ${
      isOnline
        ? "bg-green-500/20 border-green-500/30 text-green-400"
        : "bg-red-500/20 border-red-500/30 text-red-400"
    }`}>
      {isOnline
        ? <><Wifi className="w-4 h-4" /> Connection restored</>
        : <><WifiOff className="w-4 h-4" /> You're offline — changes won't be saved</>
      }
    </div>
  );
}