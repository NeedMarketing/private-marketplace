import webpush from 'web-push'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient as createSessionClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const VAPID_PUBLIC =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BA0mERkz2T2CiiGU_Rlmft-WABhyhknX12K3ViHSsmj5vOeCsnNFU4jJICF1-dC1sa2_m_pHtttjJwXVfP0jtoM'
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
// Service-role key bypasses RLS — server-only, used here just to read the
// recipient's push subscriptions (which the sender can't read under RLS).
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: Request) {
  // Push not configured — no-op so message sending never breaks.
  if (!VAPID_PRIVATE || !SUPABASE_URL || !SERVICE_ROLE) {
    return Response.json({ ok: false, reason: 'push-not-configured' })
  }

  try {
    // 1) AUTH: identify the caller from their session cookie — NEVER from the body.
    const session = createSessionClient()
    const { data: { user } } = await session.auth.getUser()
    if (!user) {
      console.warn('[notify] unauthorized attempt')
      return Response.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
    }

    // 2) RATE LIMIT per user (best-effort).
    const rl = rateLimit(`notify:${user.id}`, 30, 60_000)
    if (!rl.ok) {
      console.warn(`[notify] rate-limited user=${user.id}`)
      return Response.json({ ok: false, reason: 'rate-limited' }, { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } })
    }

    // 3) INPUT VALIDATION (shape).
    const body = await req.json().catch(() => null)
    const conversationId = body?.conversationId
    if (typeof conversationId !== 'string' || !UUID.test(conversationId)) {
      return Response.json({ ok: false, reason: 'bad-request' }, { status: 400 })
    }
    // senderId is derived from the verified session — body senderId is ignored.
    const senderId = user.id

    webpush.setVapidDetails('mailto:notifications@privatecarz.com', VAPID_PUBLIC, VAPID_PRIVATE)
    const admin = createAdminClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

    const { data: conv } = await admin
      .from('conversations')
      .select('buyer_id, seller_id, listing_title')
      .eq('id', conversationId)
      .maybeSingle()
    if (!conv) return Response.json({ ok: false, reason: 'not-found' }, { status: 404 })

    // 4) OWNERSHIP: the caller must be a participant of this conversation.
    if (senderId !== conv.buyer_id && senderId !== conv.seller_id) {
      console.warn(`[notify] forbidden: user=${senderId} not in conversation=${conversationId}`)
      return Response.json({ ok: false, reason: 'forbidden' }, { status: 403 })
    }
    const recipient = conv.buyer_id === senderId ? conv.seller_id : conv.buyer_id
    if (!recipient) return Response.json({ ok: true, sent: 0 })

    const { data: senderProfile } = await admin.from('profiles').select('full_name').eq('id', senderId).maybeSingle()
    const fromName = senderProfile?.full_name || 'A buyer'

    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('endpoint, subscription')
      .eq('user_id', recipient)
    if (!subs || subs.length === 0) return Response.json({ ok: true, sent: 0 })

    const payload = JSON.stringify({
      title: `New message from ${fromName}`,
      body: conv.listing_title ? `About: ${conv.listing_title}` : 'You have a new message on private.',
      url: `/messages/${conversationId}`,
      tag: `conv-${conversationId}`,
    })

    let sent = 0
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(s.subscription as webpush.PushSubscription, payload)
          sent++
        } catch (err: unknown) {
          const code = (err as { statusCode?: number })?.statusCode
          if (code === 404 || code === 410) {
            await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
          } else {
            console.error('[notify] web-push send error:', code)
          }
        }
      })
    )
    return Response.json({ ok: true, sent })
  } catch (e) {
    // Generic error — never leak stack traces to the client.
    console.error('[notify] route error:', e)
    return Response.json({ ok: false, reason: 'error' }, { status: 500 })
  }
}
