import { createClient } from '@supabase/supabase-js';

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return createClient(url, key);
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return getClient();
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Lazy singletons — created on first request, not at build time
let _supabase;
let _supabaseAdmin;

export const supabase = new Proxy({}, {
  get(_, prop) { return (_supabase ??= getClient())[prop]; },
});

export const supabaseAdmin = new Proxy({}, {
  get(_, prop) { return (_supabaseAdmin ??= getAdminClient())[prop]; },
});
