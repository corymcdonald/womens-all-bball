import { createClient } from "@supabase/supabase-js";

// Server-only client using Supabase secret key (sb_secret_...).
// Never imported from client code.
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
);
