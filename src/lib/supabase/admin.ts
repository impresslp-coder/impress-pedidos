import { createClient } from "@supabase/supabase-js";

// SOLO usar en server actions — nunca en cliente
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
