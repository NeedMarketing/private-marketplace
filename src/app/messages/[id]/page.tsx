"use client"

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/context/AuthContext'
import { createClient } from '@/lib/supabase/client'
import { notifyNewMessage } from '@/lib/push'
import { formatPrice, timeAgo, storageImage } from '@/lib/utils'
import type { Conversation, Message, Listing, Offer } from '@/lib/types'

export default function ThreadPage({ params }: { params: { id: string } }) {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [otherName, setOtherName] = useState('')
  const [listing, setListing] = useState<Listing | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [offers, setOffers] = useState<Offer[]>([])
  const [notFound, setNotFound] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!loading && !user) { router.push('/auth/login'); return }
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    const supabase = createClient()

    const load = async () => {
      // Conversation + messages in parallel. No profile embed (so a missing FK
      // can't error the query); maybeSingle so a missing row returns null cleanly.
      const [{ data: conv, error: convErr }, { data: msgs }] = await Promise.all([
        supabase
          .from('conversations')
          .select('id, listing_id, buyer_id, seller_id, listing_title, listing_image, last_message, last_message_at, created_at')
          .eq('id', params.id)
          .maybeSingle(),
        supabase
          .from('messages')
          .select('id, conversation_id, sender_id, sender_name, text, created_at')
          .eq('conversation_id', params.id)
          .order('created_at', { ascending: true }),
      ])

      if (convErr) { console.error('Conversation fetch failed:', convErr); setNotFound(true); return }
      if (!conv) { setNotFound(true); return }
      // Authorization is also enforced by RLS; this is a friendly client guard.
      if (conv.buyer_id !== user.id && conv.seller_id !== user.id) { router.push('/messages'); return }

      setConversation(conv)
      setMessages(msgs || [])

      // Resolve the OTHER participant's display name separately (no embed).
      const otherId = conv.buyer_id === user.id ? conv.seller_id : conv.buyer_id
      supabase
        .from('profiles')
        .select('full_name')
        .eq('id', otherId)
        .maybeSingle()
        .then(({ data: p }) => setOtherName(p?.full_name || 'Private Seller'))

      // Listing context — maybeSingle so a sold/deleted listing doesn't throw.
      supabase
        .from('listings')
        .select('id, year, make, model, price, location, images, negotiation_price, negotiation_buyer_id')
        .eq('id', conv.listing_id)
        .maybeSingle()
        .then(({ data: l }) => setListing(l as typeof l & Listing))

      // Offers in this conversation (for the accept-offer banner).
      supabase
        .from('offers')
        .select('id, listing_id, buyer_id, seller_id, conversation_id, amount, status, created_at')
        .eq('conversation_id', params.id)
        .order('created_at', { ascending: true })
        .then(({ data }) => setOffers((data || []) as Offer[]))
    }
    load()

    // Realtime subscription for new messages
    const channel = supabase
      .channel(`conv-${params.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${params.id}`,
      }, (payload) => {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === (payload.new as Message).id)
          return exists ? prev : [...prev, payload.new as Message]
        })
      })
      .subscribe()

    // Polling fallback: refetch every 4s so new messages still arrive even if
    // Realtime isn't enabled for this table. Deduped by id, so it never doubles
    // up with the realtime/optimistic paths.
    const poll = setInterval(async () => {
      // Skip polling when the tab is hidden — saves a lot of needless requests.
      if (typeof document !== 'undefined' && document.hidden) return
      const { data: fresh } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, sender_name, text, created_at')
        .eq('conversation_id', params.id)
        .order('created_at', { ascending: true })
      if (fresh) {
        setMessages((prev) => {
          if (fresh.length === prev.length && fresh[fresh.length - 1]?.id === prev[prev.length - 1]?.id) return prev
          const byId = new Map(prev.map((m) => [m.id, m]))
          ;(fresh as Message[]).forEach((m) => byId.set(m.id, m))
          return Array.from(byId.values()).sort((a, b) => a.created_at.localeCompare(b.created_at))
        })
      }
    }, 12000)

    return () => { supabase.removeChannel(channel); clearInterval(poll) }
  }, [params.id, user, router, loading])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || sending || !user || !conversation) return
    setSending(true)
    setSendError('')
    const text = input.trim()
    setInput('')
    const supabase = createClient()

    // Insert and read the row back so the sender sees their message immediately,
    // independent of whether the realtime echo arrives. NEVER store email as the
    // display name — fall back to a generic label.
    const { data: inserted, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        sender_name: profile?.full_name || 'User',
        text,
      })
      .select('id, conversation_id, sender_id, sender_name, text, created_at')
      .single()

    if (error || !inserted) {
      console.error('Send failed:', error)
      setSendError(error?.message || 'Message could not be sent. Please try again.')
      setInput(text) // restore so the user doesn't lose their text
      setSending(false)
      return
    }

    // Optimistically append (dedup against the realtime echo by id).
    setMessages((prev) => prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted as Message])

    // Notify the other participant via push (fire-and-forget).
    notifyNewMessage(conversation.id, user.id)

    // Update conversation preview; non-fatal if it fails.
    const { error: updErr } = await supabase
      .from('conversations')
      .update({ last_message: text, last_message_at: new Date().toISOString() })
      .eq('id', conversation.id)
    if (updErr) console.error('Conversation preview update failed:', updErr)

    setSending(false)
    inputRef.current?.focus()
  }

  // Seller accepts an offer → the listing goes "In negotiation" at that price/buyer.
  const acceptOffer = async (offer: Offer) => {
    if (!user || !conversation) return
    const supabase = createClient()
    const { error: lErr } = await supabase
      .from('listings')
      .update({ negotiation_price: offer.amount, negotiation_buyer_id: offer.buyer_id })
      .eq('id', offer.listing_id)
    if (lErr) { console.error('Accept offer failed:', lErr); alert(lErr.message); return }
    await supabase.from('offers').update({ status: 'accepted' }).eq('id', offer.id)
    setOffers((prev) => prev.map((o) => o.id === offer.id ? { ...o, status: 'accepted' } : o))
    setListing((prev) => prev ? { ...prev, negotiation_price: offer.amount, negotiation_buyer_id: offer.buyer_id } : prev)

    const text = `✅ Offer accepted — now in negotiation at ${formatPrice(offer.amount)}`
    const { data: m } = await supabase.from('messages')
      .insert({ conversation_id: conversation.id, sender_id: user.id, sender_name: profile?.full_name || 'Seller', text })
      .select('id, conversation_id, sender_id, sender_name, text, created_at').single()
    if (m) setMessages((prev) => [...prev, m as Message])
    await supabase.from('conversations').update({ last_message: text, last_message_at: new Date().toISOString() }).eq('id', conversation.id)
    notifyNewMessage(conversation.id, user.id)
  }

  const isSeller = !!conversation && conversation.seller_id === user?.id
  const latestPending = [...offers].reverse().find((o) => o.status === 'pending')

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  if (loading || !user) return <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#111111] border-t-transparent rounded-full animate-spin" /></div>

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#FAFAF7]"><Navbar />
        <div className="max-w-7xl mx-auto px-5 py-32 text-center">
          <p className="text-[16px] text-[#6B6B6B] mb-4">Conversation not found.</p>
          <Link href="/messages" className="text-[14px] font-semibold text-[#111111] underline">Back to messages</Link>
        </div>
      </div>
    )
  }

  // Group messages by date
  const groups: { date: string; messages: Message[] }[] = []
  messages.forEach((m) => {
    const date = new Date(m.created_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    const last = groups[groups.length - 1]
    if (last && last.date === date) last.messages.push(m)
    else groups.push({ date, messages: [m] })
  })

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
      <Navbar />

      {/* Thread header */}
      <div className="bg-white border-b border-[#E5E5E5] sticky top-16 z-40">
        <div className="max-w-3xl mx-auto px-5 py-3 flex items-center gap-4">
          <Link href="/messages" className="w-8 h-8 rounded-full hover:bg-[#F5F5F3] flex items-center justify-center transition-colors shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </Link>

          {listing && (
            <Link href={`/listing/${listing.id}`} className="flex items-center gap-3 flex-1 min-w-0 group">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#F5F5F3] shrink-0">
                <img src={storageImage(listing.images[0], { width: 80, quality: 65 })} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[#111111] truncate group-hover:underline">{conversation?.listing_title}</p>
                <p className="text-[12px] text-[#6B6B6B]">{formatPrice(listing.price)} · {listing.location}</p>
              </div>
            </Link>
          )}

          <div className="ml-auto text-right shrink-0">
            <p className="text-[13px] font-semibold text-[#111111]">{otherName || 'Private Seller'}</p>
            <div className="flex items-center gap-1 justify-end">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              <p className="text-[11px] text-[#6B6B6B]">Verified</p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-5 py-6 pb-2">
          {messages.length === 0 ? (
            <p className="text-center text-[13px] text-[#6B6B6B] py-8">No messages yet. Say hello!</p>
          ) : (
            groups.map((group) => (
              <div key={group.date}>
                <div className="flex items-center gap-3 my-6">
                  <div className="flex-1 h-px bg-[#E5E5E5]" />
                  <span className="text-[11px] font-medium text-[#6B6B6B] whitespace-nowrap">{group.date}</span>
                  <div className="flex-1 h-px bg-[#E5E5E5]" />
                </div>

                {group.messages.map((m, i) => {
                  const isMe = m.sender_id === user.id
                  const showName = !isMe && (i === 0 || group.messages[i - 1].sender_id !== m.sender_id)
                  const isLast = i === group.messages.length - 1 || group.messages[i + 1].sender_id !== m.sender_id

                  return (
                    <div key={m.id} className={`flex mb-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                        {showName && !isMe && (
                          <p className="text-[11px] font-semibold text-[#6B6B6B] mb-1 ml-1">{m.sender_name}</p>
                        )}
                        <div className={`px-4 py-2.5 text-[14px] leading-relaxed break-words ${isMe ? 'bg-[#111111] text-white rounded-2xl rounded-br-md' : 'bg-white border border-[#E5E5E5] text-[#111111] rounded-2xl rounded-bl-md'}`}>
                          {m.text}
                        </div>
                        {isLast && (
                          <p className={`text-[10px] text-[#6B6B6B] mt-1 ${isMe ? 'mr-1' : 'ml-1'}`}>{timeAgo(m.created_at)}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      {/* Offer banner */}
      {latestPending && (
        <div className="bg-amber-50 border-t border-amber-200">
          <div className="max-w-3xl mx-auto px-5 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold text-amber-900">Offer on the table: {formatPrice(latestPending.amount)}</p>
              <p className="text-[11px] text-amber-700">{isSeller ? 'Accept to put this car in negotiation at that price.' : 'Waiting for the seller to respond.'}</p>
            </div>
            {isSeller && (
              <button onClick={() => acceptOffer(latestPending)} className="bg-[#111111] text-white text-[13px] font-semibold px-5 py-2.5 rounded-full hover:bg-[#333] transition-colors whitespace-nowrap shrink-0">
                Accept {formatPrice(latestPending.amount)}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="bg-white border-t border-[#E5E5E5] sticky bottom-0">
        <div className="max-w-3xl mx-auto px-5 py-3">
          {sendError && <p className="text-[12px] text-red-600 mb-2 text-center">{sendError}</p>}
          <div className="flex items-end gap-3">
            <div className="flex-1 bg-[#F5F5F3] rounded-2xl px-4 py-3 flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message…"
                rows={1}
                className="flex-1 bg-transparent outline-none text-[14px] text-[#111111] placeholder:text-[#6B6B6B] resize-none max-h-32 leading-relaxed"
                style={{ overflowY: input.split('\n').length > 3 ? 'auto' : 'hidden' }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="w-10 h-10 bg-[#111111] rounded-full flex items-center justify-center hover:bg-[#333] transition-colors disabled:opacity-30 shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
          <p className="text-[11px] text-[#6B6B6B] text-center mt-2">Press Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  )
}
