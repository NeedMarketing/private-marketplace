import { createClient } from '@/lib/supabase/client'

// Public VAPID key (safe to expose). Falls back to the project key if the env
// var isn't set, so push still works without extra config.
const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BA0mERkz2T2CiiGU_Rlmft-WABhyhknX12K3ViHSsmj5vOeCsnNFU4jJICF1-dC1sa2_m_pHtttjJwXVfP0jtoM'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function pushStatus(): Promise<'unsupported' | 'denied' | 'granted' | 'default'> {
  if (!pushSupported()) return 'unsupported'
  return Notification.permission as 'denied' | 'granted' | 'default'
}

// Request permission, register the SW, subscribe, and save the subscription.
export async function enablePush(userId: string): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) return { ok: false, error: 'Notifications are not supported in this browser.' }
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return { ok: false, error: 'Notifications were not allowed.' }

    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    const existing = await reg.pushManager.getSubscription()
    const sub = existing || (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    }))

    const json = sub.toJSON() as { endpoint?: string }
    const supabase = createClient()
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({ user_id: userId, endpoint: json.endpoint, subscription: json }, { onConflict: 'endpoint' })
    if (error) { console.error('Save push subscription failed:', error); return { ok: false, error: error.message } }
    return { ok: true }
  } catch (e) {
    console.error('enablePush failed:', e)
    return { ok: false, error: e instanceof Error ? e.message : 'Could not enable notifications.' }
  }
}

// Fire-and-forget: ask the server to push a new-message notification to the
// OTHER participant of a conversation. Never blocks or breaks message sending.
export function notifyNewMessage(conversationId: string, senderId: string) {
  try {
    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, senderId }),
      keepalive: true,
    }).catch(() => {})
  } catch { /* ignore */ }
}
