import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ─────────────────────────────────────────────────────────────────────────────
//  SERVER Supabase client (Server Components, Route Handlers, middleware).
//  Still uses the ANON key — it is bound to the signed-in user's session via
//  cookies, so RLS applies as that user. Use this for anything acting "as the
//  logged-in user" on the server.
//
//  For privileged admin work that must bypass RLS (e.g. the push-notify route),
//  use a separate service-role client created INLINE in that server file from
//  process.env.SUPABASE_SERVICE_ROLE_KEY. The service-role key bypasses ALL RLS
//  and must NEVER be imported into a client/browser component or exposed via a
//  NEXT_PUBLIC_* variable.
// ─────────────────────────────────────────────────────────────────────────────
export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try { cookieStore.set({ name, value, ...options }) } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }) } catch {}
        },
      },
    }
  )
}
