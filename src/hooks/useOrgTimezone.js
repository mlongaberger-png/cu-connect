import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Returns the organization's configured IANA timezone, or `undefined` if none
 * is set. When `undefined`, callers should pass `timeZone: undefined` to
 * `toLocaleTimeString`/`toLocaleDateString`, which falls back to the viewer's
 * browser-local timezone — always correct behavior.
 *
 * The org timezone (if configured) is stored as an AppConfig record with
 * key "org_timezone" whose value is a JSON string, e.g. "America/New_York".
 */
export function useOrgTimezone() {
  const { data } = useQuery({
    queryKey: ["org-timezone"],
    queryFn: async () => {
      const configs = await base44.entities.AppConfig.filter({ key: "org_timezone" });
      return configs[0]?.value || null;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  let timeZone = undefined;
  if (data) {
    try {
      timeZone = JSON.parse(data);
    } catch {
      timeZone = data;
    }
  }
  return { timeZone };
}