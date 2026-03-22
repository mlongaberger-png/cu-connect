import React from "react";
import { Globe } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrgTimezone, COMMON_TIMEZONES } from "@/lib/useOrgTimezone";

/**
 * Admin-only dropdown to set the org's display timezone.
 * Shows the current timezone abbreviation for everyone.
 */
export default function TimezoneSelector({ canEdit = false }) {
  const { timezone, abbr, setTimezone } = useOrgTimezone();

  if (!canEdit) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Globe className="w-3.5 h-3.5" /> {abbr || "CT"}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <Select value={timezone} onValueChange={setTimezone}>
        <SelectTrigger className="h-8 text-xs bg-surface border-border w-52">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-popover border-border">
          {COMMON_TIMEZONES.map(tz => (
            <SelectItem key={tz.value} value={tz.value} className="text-xs">
              {tz.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}