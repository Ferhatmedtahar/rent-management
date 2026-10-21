import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/shared/supabase/browser";

export function useLeaseSlips(leaseId: string) {
  return useQuery({
    queryKey: ["leases", "slips", leaseId] as const,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("payments")
        .select("id, slip_path")
        .eq("lease_id", leaseId);

      if (error) {
        return {} as Record<string, string>;
      }

      const paths: Record<string, string> = {};
      for (const row of data ?? []) {
        if (row.slip_path) {
          paths[row.id] = row.slip_path;
        }
      }
      return paths;
    },
    enabled: Boolean(leaseId),
  });
}
