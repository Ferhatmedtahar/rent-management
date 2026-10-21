"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/shared/supabase/browser";
import { queryKeys } from "@/shared/lib/query-keys";

export type LeaseFormOption = {
  id: string;
  name: string;
};

type LeaseFormOptions = {
  units: LeaseFormOption[];
  tenants: LeaseFormOption[];
};

async function fetchLeaseFormOptions(
  signal?: AbortSignal,
): Promise<LeaseFormOptions> {
  const supabase = createClient();

  let unitsQuery = supabase.from("units").select("id, name").order("name");
  let tenantsQuery = supabase.from("tenants").select("id, name").order("name");
  if (signal) {
    unitsQuery = unitsQuery.abortSignal(signal);
    tenantsQuery = tenantsQuery.abortSignal(signal);
  }

  const [unitsRes, tenantsRes] = await Promise.all([unitsQuery, tenantsQuery]);

  if (unitsRes.error) {
    throw new Error(unitsRes.error.message || "Could not load units");
  }
  if (tenantsRes.error) {
    throw new Error(tenantsRes.error.message || "Could not load tenants");
  }

  return {
    units: unitsRes.data ?? [],
    tenants: tenantsRes.data ?? [],
  };
}

/**
 * Units and tenants the manager can pick when creating a lease. Reads go
 * through supabase-js, so RLS limits both lists to the caller's organization.
 */
export function useLeaseFormOptions(enabled = true) {
  return useQuery({
    queryKey: queryKeys.leases.formOptions(),
    queryFn: ({ signal }) => fetchLeaseFormOptions(signal),
    enabled,
  });
}
