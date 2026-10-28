// PERSON C OWNS THIS FILE.
// The client is null when env vars are absent, so every route must handle that
// and fall back to lib/demo.ts. The app has to run with zero config.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
export const hasSupabase = Boolean(supabase);
