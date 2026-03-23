import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";

export default function MessageReadReceipts({ messageId, channelId, isStaff }) {
  const [showList, setShowList] = useState(false);

  const { data: receipts = [] } = useQuery({
    queryKey: ["read-receipts", messageId],
    queryFn: () => base44.entities.MessageReadReceipt.filter({ message_id: messageId }),
    enabled: isStaff && !!messageId,
    refetchInterval: 15000,
  });

  if (!isStaff || receipts.length === 0) return null;

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowList(v => !v)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors mt-1"
      >
        <Eye className="w-3 h-3" />
        <span>{receipts.length} seen</span>
      </button>

      {showList && (
        <div className="absolute bottom-full left-0 mb-1 bg-popover border border-border rounded-xl shadow-lg p-3 z-50 min-w-[180px] max-w-[240px]">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Seen by
          </p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {receipts.map(r => (
              <div key={r.id} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {r.reader_avatar
                    ? <img src={r.reader_avatar} alt={r.reader_name} className="w-full h-full object-cover" />
                    : <span className="text-[8px] font-bold text-primary">{(r.reader_name || "?")[0].toUpperCase()}</span>
                  }
                </div>
                <span className="text-xs text-foreground truncate">{r.reader_name || r.reader_email}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}