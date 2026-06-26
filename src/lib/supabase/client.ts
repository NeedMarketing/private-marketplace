import { createBrowserClient } from '@supabase/ssr'

// ─────────────────────────────────────────────────────────────────────────────
//  BROWSER Supabase client.
//  Uses ONLY the public anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY). This key is
//  safe to ship to the browser BECAUSE every table is protected by Row Level
//  Security — the anon key can only do what RLS policies allow.
//  NEVER use the service-role key here. It would be exposed to every visitor and
//  bypasses RLS entirely.
// ─────────────────────────────────────────────────────────────────────────────
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
  )
}
