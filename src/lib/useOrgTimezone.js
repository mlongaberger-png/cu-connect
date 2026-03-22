import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const DEFAULT_TZ = "America/Chicago";

export function useOrgTimezone() {
  const queryClient = useQueryClient();

  const { data: configs = [] } = useQuery({
    queryKey: ["appconfig", "timezone"],
    queryFn: () => base44.entities.AppConfig.filter({ key: "org_timezone" }),
    staleTime: 60_000,
  });

  const record = configs[0];
  const timezone = record?.value || DEFAULT_TZ;

  // Get short abbreviation like "CST" or "CDT"
  const abbr = (() => {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        timeZoneName: "short",
      }).formatToParts(new Date());
      return parts.find(p => p.type === "timeZoneName")?.value || "";
    } catch {
      return "";
    }
  })();

  const mutation = useMutation({
    mutationFn: async (tz) => {
      if (record?.id) {
        return base44.entities.AppConfig.update(record.id, { value: tz });
      } else {
        return base44.entities.AppConfig.create({ key: "org_timezone", value: tz });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appconfig", "timezone"] }),
  });

  return { timezone, abbr, setTimezone: (tz) => mutation.mutate(tz) };
}

export const COMMON_TIMEZONES = [
  { label: "Central Time (CST/CDT)", value: "America/Chicago" },
  { label: "Eastern Time (EST/EDT)", value: "America/New_York" },
  { label: "Mountain Time (MST/MDT)", value: "America/Denver" },
  { label: "Pacific Time (PST/PDT)", value: "America/Los_Angeles" },
  { label: "Alaska Time", value: "America/Anchorage" },
  { label: "Hawaii Time", value: "Pacific/Honolulu" },
];