import "server-only";

import { createAdminClient } from "@/shared/supabase/admin";
import type { SlipStorage } from "../types/payment.types";

const BUCKET = "payment-slips";

/** Slip files in the private bucket, through the admin client (server only). */
export const slipStorage: SlipStorage = {
  async exists(path) {
    const { data, error } = await createAdminClient()
      .storage.from(BUCKET)
      .exists(path);
    if (error) throw new Error(`Storage check failed: ${error.message}`);
    return data;
  },

  async remove(path) {
    const { error } = await createAdminClient()
      .storage.from(BUCKET)
      .remove([path]);
    if (error) throw new Error(`Storage remove failed: ${error.message}`);
  },
};
