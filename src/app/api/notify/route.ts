import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const VAPID_PUBLIC =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BA0mERkz2T2CiiGU_Rlmft-WABhyhknX12K3ViHSsmj5vOeCsnNFU4jJICF1-dC1sa2_m_pHtttjJwXVfP0jtoM'
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(req: Request) {
  // Push isn't configured — no-op so message sending never breaks.
  if (!VAPID_PRIVATE || !SUPABASE_URL || !SERVICE_ROLE) {
    return Response.json({ ok: false, reason: 'push-not-configured' })
  }

  try {
    const { conversationId, senderId } = await req.json()
    if (!conversationId || !senderId) return Response.json({ ok: false, reason: 'bad-request' }, { status: 400 })

    webpush.setVapidDetails('mailto:notifications@privatecarz.com', VAPID_PUBLIC, VAPID_PRIVATE)

    // Service-role client (server-only) to look up the recipient + their subscriptions.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

    const { data: conv } = await admin
      .from('conversations')
      .select('buyer_id, seller_id, listing_title')
      .eq('id', conversationId)
      .maybeSingle()
    if (!conv) return Response.json({ ok: false, reason: 'no-conversation' })

    // Recipient = the participant who isn't the sender.
    const recipient = conv.buyer_id === senderId ? conv.seller_id : conv.buyer_id
    if (!recipient || (senderId !== conv.buyer_id && senderId !== conv.seller_id)) {
      return Response.json({ ok: false, reason: 'not-a-participant' })
    }

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
          // Subscription is gone — clean it up.
          if (code === 404 || code === 410) {
            await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
          } else {
            console.error('web-push send error:', err)
          }
        }
      })
    )
    return Response.json({ ok: true, sent })
  } catch (e) {
    console.error('notify route error:', e)
    return Response.json({ ok: false, reason: 'error' }, { status: 500 })
  }
}
