"use client"

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Comments from '@/components/Comments'
import DealRating from '@/components/DealRating'
import { useAuth } from '@/context/AuthContext'
import { createClient } from '@/lib/supabase/client'
import { notifyNewMessage } from '@/lib/push'
import { formatPrice, formatMileage, storageImage } from '@/lib/utils'
import type { Listing } from '@/lib/types'

export default function ListingClient({ initialListing }: { initialListing: Listing }) {
  const { user, profile } = useAuth()
  const router = useRouter()
  const [listing, setListing] = useState<Listing>(initialListing)
  const [activeImg, setActiveImg] = useState(0)
  const [messaging, setMessaging] = useState(false)
  const [msgError, setMsgError] = useState('')
  const [interested, setInterested] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [liked, setLiked] = useState(false)
  const [offerOpen, setOfferOpen] = useState(false)
  const [offerAmount, setOfferAmount] = useState('')
  const [offerError, setOfferError] = useState('')
  const [offerSubmitting, setOfferSubmitting] = useState(false)
  const touchStartX = useRef<number | null>(null)

  const isOwner = user && listing.seller_id === user.id
  const inNegotiation = listing.negotiation_price != null
  const isNegBuyer = !!user && listing.negotiation_buyer_id === user.id
  // An outsider can't open a normal chat while the car is in negotiation — only outbid.
  const locked = inNegotiation && !isNegBuyer && !isOwner
  const minOffer = inNegotiation ? (listing.negotiation_price as number) + 1 : 0

  // Load the persistent like count + whether the current user has liked it.
  useEffect(() => {
    const supabase = createClient()
    supabase.from('listing_likes').select('id', { count: 'exact', head: true }).eq('listing_id', listing.id)
      .then(({ count }) => setLikeCount(count || 0))
    if (user) {
      supabase.from('listing_likes').select('id').eq('listing_id', listing.id).eq('user_id', user.id).maybeSingle()
        .then(({ data }) => setLiked(!!data))
    } else {
      setLiked(false)
    }
  }, [listing.id, user])

  const toggleLike = async () => {
    if (!user) { router.push(`/auth/login?next=/listing/${listing.id}`); return }
    const supabase = createClient()
    if (liked) {
      setLiked(false); setLikeCount((c) => Math.max(0, c - 1))
      const { error } = await supabase.from('listing_likes').delete().eq('listing_id', listing.id).eq('user_id', user.id)
      if (error) { setLiked(true); setLikeCount((c) => c + 1); alert(error.message) }
    } else {
      setLiked(true); setLikeCount((c) => c + 1)
      const { error } = await supabase.from('listing_likes').insert({ listing_id: listing.id, user_id: user.id })
      if (error) { setLiked(false); setLikeCount((c) => Math.max(0, c - 1)); console.error(error) }
    }
  }
  const sellerProfile = listing.profiles as { full_name?: string; email?: string } | undefined
  const sellerName = sellerProfile?.full_name || 'Private Seller'
  const sellerEmail = sellerProfile?.email || ''
  // Seller is reachable by email only if they opted into email contact.
  const showEmail = (listing.contact_preference === 'email' || listing.contact_preference === 'both') && !!sellerEmail

  const handleMessage = async () => {
    if (!user) { router.push(`/auth/login?next=/listing/${listing.id}`); return }
    if (isOwner) return
    setMessaging(true)
    setMsgError('')
    try {
      const supabase = createClient()
      // Upsert conversation (idempotent — same buyer+listing = same conversation)
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('listing_id', listing.id)
        .eq('buyer_id', user.id)
        .maybeSingle()

      if (existing) {
        router.push(`/messages/${existing.id}`)
        return
      }

      const { data: conv, error } = await supabase
        .from('conversations')
        .insert({
          listing_id: listing.id,
          buyer_id: user.id,
          seller_id: listing.seller_id,
          listing_title: `${listing.year} ${listing.make} ${listing.model}`,
          listing_image: listing.images[0] || '',
          last_message: '',
          last_message_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (error || !conv) {
        console.error('Conversation create failed:', error)
        setMsgError(error?.message || 'Could not start the conversation. Please try again.')
        setMessaging(false)
        return
      }

      // Send intro message
      const introText = `Hi! I'm interested in your ${listing.year} ${listing.make} ${listing.model}. Is it still available?`
      const { error: msgErr } = await supabase.from('messages').insert({
        conversation_id: conv.id,
        sender_id: user.id,
        sender_name: profile?.full_name || 'Buyer',
        text: introText,
      })
      if (msgErr) {
        console.error('Intro message failed:', msgErr)
        setMsgError(msgErr.message || 'Could not send your message. Please try again.')
        setMessaging(false)
        return
      }
      await supabase
        .from('conversations')
        .update({ last_message: introText, last_message_at: new Date().toISOString() })
        .eq('id', conv.id)

      // Notify the seller via push (fire-and-forget).
      notifyNewMessage(conv.id, user.id)

      router.push(`/messages/${conv.id}`)
    } catch (e) {
      console.error(e)
      setMsgError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
      setMessaging(false)
    }
  }

  const handleMarkSold = async () => {
    if (!confirm('Mark this car as sold?')) return
    const supabase = createClient()
    const { data, error } = await supabase
      .from('listings')
      .update({ status: 'sold' })
      .eq('id', listing.id)
      .select('id, status, updated_at')
      .single()
    if (error) { console.error('Mark sold failed:', error); alert(error.message); return }
    if (data) setListing((prev) => ({ ...prev, status: 'sold' }))
  }

  // Submit an offer (initial, or a higher offer to outbid). Creates/reuses the
  // buyer↔seller conversation, posts the offer message + an offers row, notifies.
  const submitOffer = async () => {
    if (!user) { router.push(`/auth/login?next=/listing/${listing.id}`); return }
    const amount = Math.round(Number(offerAmount))
    if (!amount || amount <= 0) { setOfferError('Enter an offer amount.'); return }
    if (inNegotiation && amount <= (listing.negotiation_price as number)) {
      setOfferError(`Your offer must be higher than the current ${formatPrice(listing.negotiation_price as number)}.`)
      return
    }
    setOfferSubmitting(true); setOfferError('')
    try {
      const supabase = createClient()
      let convId: string
      const { data: existing } = await supabase.from('conversations').select('id')
        .eq('listing_id', listing.id).eq('buyer_id', user.id).maybeSingle()
      if (existing) {
        convId = existing.id
      } else {
        const { data: conv, error } = await supabase.from('conversations').insert({
          listing_id: listing.id, buyer_id: user.id, seller_id: listing.seller_id,
          listing_title: `${listing.year} ${listing.make} ${listing.model}`,
          listing_image: listing.images[0] || '', last_message: '', last_message_at: new Date().toISOString(),
        }).select('id').single()
        if (error || !conv) { setOfferError(error?.message || 'Could not start the offer.'); setOfferSubmitting(false); return }
        convId = conv.id
      }

      const offerText = `💰 Offer: ${formatPrice(amount)}`
      await supabase.from('messages').insert({ conversation_id: convId, sender_id: user.id, sender_name: profile?.full_name || 'Buyer', text: offerText })
      const { error: offErr } = await supabase.from('offers').insert({
        listing_id: listing.id, buyer_id: user.id, seller_id: listing.seller_id, conversation_id: convId, amount, status: 'pending',
      })
      if (offErr) { console.error('Offer insert failed:', offErr); setOfferError(offErr.message); setOfferSubmitting(false); return }
      await supabase.from('conversations').update({ last_message: offerText, last_message_at: new Date().toISOString() }).eq('id', convId)
      notifyNewMessage(convId, user.id)
      router.push(`/messages/${convId}`)
    } catch (e) {
      setOfferError(e instanceof Error ? e.message : 'Something went wrong.'); setOfferSubmitting(false)
    }
  }

  const specs = [
    { label: 'Mileage', value: formatMileage(listing.mileage) },
    { label: 'Year', value: String(listing.year) },
    { label: 'Transmission', value: listing.transmission },
    { label: 'Fuel type', value: listing.fuel_type },
    { label: 'Ext. color', value: listing.color || '—' },
    { label: 'Int. color', value: listing.interior_color || '—' },
    { label: 'Condition', value: listing.condition },
    { label: 'Title', value: listing.title_status },
  ]

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <Navbar />

      {/* Offer / higher-offer modal */}
      {offerOpen && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setOfferOpen(false)}>
          <div className="bg-white rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.2)] w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[17px] font-semibold text-[#111111] mb-1">{inNegotiation ? 'Make a higher offer' : 'Make an offer'}</h3>
            <p className="text-[13px] text-[#6B6B6B] mb-4">
              {inNegotiation
                ? `Currently in negotiation at ${formatPrice(listing.negotiation_price as number)}. Your offer must be higher.`
                : `Asking price ${formatPrice(listing.price)}. Send the seller your offer.`}
            </p>
            <div className="relative mb-3">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] text-[#6B6B6B]">$</span>
              <input
                type="number" autoFocus value={offerAmount} min={minOffer || undefined}
                onChange={(e) => setOfferAmount(e.target.value)}
                placeholder={inNegotiation ? String(minOffer) : String(listing.price)}
                className="w-full border border-[#E5E5E5] rounded-xl pl-8 pr-4 py-3 text-[15px] text-[#111111] outline-none focus:border-[#111111]"
              />
            </div>
            {offerError && <p className="text-[12px] text-red-600 mb-3">{offerError}</p>}
            <div className="flex gap-3">
              <button onClick={() => setOfferOpen(false)} className="flex-1 py-3 rounded-xl border border-[#E5E5E5] text-[14px] font-medium text-[#6B6B6B] hover:border-[#111111] transition-colors">Cancel</button>
              <button onClick={submitOffer} disabled={offerSubmitting} className="flex-1 py-3 rounded-xl bg-[#111111] text-white text-[14px] font-semibold hover:bg-[#333] transition-colors disabled:opacity-50">{offerSubmitting ? 'Sending…' : 'Send offer'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-5 py-8">
        <Link href="/browse" className="inline-flex items-center gap-1.5 text-[13px] text-[#6B6B6B] hover:text-[#111111] transition-colors mb-6">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back to listings
        </Link>

        <div className="grid lg:grid-cols-[1fr_360px] gap-10">

          {/* Left column */}
          <div>
            {/* Main image — swipeable carousel. object-contain = the WHOLE photo
                always fits, any orientation, never cropped or zoomed. The side/letterbox
                space is filled with a soft blurred copy of the same photo. */}
            <div
              className="relative rounded-2xl overflow-hidden shadow-[0_2px_20px_rgba(0,0,0,0.08)] mb-3 w-full aspect-[4/3] max-h-[620px] select-none"
              onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX }}
              onTouchEnd={(e) => {
                if (touchStartX.current === null || listing.images.length < 2) return
                const dx = e.changedTouches[0].clientX - touchStartX.current
                if (dx > 40) setActiveImg((i) => (i - 1 + listing.images.length) % listing.images.length)
                else if (dx < -40) setActiveImg((i) => (i + 1) % listing.images.length)
                touchStartX.current = null
              }}
            >
              {/* blurred fill behind the photo */}
              <div
                className="absolute inset-0 bg-center bg-cover scale-110 blur-2xl"
                style={{ backgroundImage: `url(${storageImage(listing.images[activeImg], { width: 100, quality: 45 }) || 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=100&q=45'})` }}
              />
              <div className="absolute inset-0 bg-black/15" />

              <img
                src={storageImage(listing.images[activeImg], { width: 1200, quality: 82 }) || 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1200&q=82'}
                alt={`${listing.year} ${listing.make} ${listing.model}`}
                className="relative z-10 w-full h-full object-contain"
              />

              {/* prev / next arrows */}
              {listing.images.length > 1 && (
                <>
                  <button
                    onClick={() => setActiveImg((i) => (i - 1 + listing.images.length) % listing.images.length)}
                    aria-label="Previous photo"
                    className="absolute z-20 left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/85 backdrop-blur-sm flex items-center justify-center shadow-md hover:bg-white transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  <button
                    onClick={() => setActiveImg((i) => (i + 1) % listing.images.length)}
                    aria-label="Next photo"
                    className="absolute z-20 right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/85 backdrop-blur-sm flex items-center justify-center shadow-md hover:bg-white transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                  <div className="absolute z-20 bottom-3 right-3 bg-black/60 text-white text-[12px] font-medium px-2.5 py-1 rounded-full">
                    {activeImg + 1} / {listing.images.length}
                  </div>
                </>
              )}

              {listing.status === 'sold' && (
                <div className="absolute inset-0 z-20 bg-black/50 flex items-center justify-center">
                  <span className="text-white text-[28px] font-bold border-4 border-white px-6 py-2 rounded-2xl rotate-[-15deg]">SOLD</span>
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {listing.images.length > 1 && (
              <div className="flex gap-2.5 overflow-x-auto pb-1 mb-8">
                {listing.images.map((img, i) => (
                  <button key={i} onClick={() => setActiveImg(i)} className={`relative w-20 h-14 shrink-0 rounded-xl overflow-hidden transition-all ${activeImg === i ? 'ring-2 ring-[#111111]' : 'opacity-55 hover:opacity-80'}`}>
                    <img src={storageImage(img, { width: 160, quality: 70 })} alt="" loading="lazy" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Mobile title */}
            <div className="lg:hidden mb-6">
              <h1 className="text-[24px] font-bold text-[#111111] tracking-tight">{listing.year} {listing.make} {listing.model}</h1>
              <p className="text-[14px] text-[#6B6B6B] mb-2">{listing.trim}</p>
              <p className="text-[28px] font-bold text-[#111111]">{formatPrice(listing.price)}</p>
            </div>

            {/* Specs grid */}
            <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] mb-5">
              <h2 className="text-[15px] font-semibold text-[#111111] mb-5">Key details</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                {specs.map((s) => (
                  <div key={s.label}>
                    <p className="text-[11px] font-semibold text-[#6B6B6B] uppercase tracking-wider mb-1">{s.label}</p>
                    <p className="text-[14px] font-semibold text-[#111111]">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            {listing.description && (
              <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] mb-5">
                <h2 className="text-[15px] font-semibold text-[#111111] mb-3">Seller description</h2>
                <p className="text-[14px] text-[#6B6B6B] leading-relaxed">{listing.description}</p>
              </div>
            )}

            {/* VIN */}
            {listing.vin && (
              <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] mb-5 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-[11px] font-semibold text-[#6B6B6B] uppercase tracking-wider mb-1">VIN</p>
                  <p className="text-[13px] font-mono text-[#111111]">{listing.vin}</p>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-full">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <span className="text-[12px] font-semibold text-emerald-700">Validated</span>
                </div>
              </div>
            )}

            {/* Comments */}
            <Comments listingId={listing.id} />

            {/* Safety tips */}
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <p className="text-[14px] font-semibold text-[#111111]">Safety tips</p>
              </div>
              <ul className="text-[13px] text-[#6B6B6B] leading-relaxed space-y-1.5">
                <li>· Meet in a public, well-lit location</li>
                <li>· Bring a trusted friend or family member</li>
                <li>· Get a pre-purchase inspection from a mechanic</li>
                <li>· Never wire money or use gift cards</li>
                <li>· Verify title ownership before exchanging funds</li>
              </ul>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="hidden lg:block">
            <div className="sticky top-24 flex flex-col gap-4">

              {/* Price card */}
              <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 shadow-[0_2px_20px_rgba(0,0,0,0.07)]">
                <h1 className="text-[18px] font-bold text-[#111111] tracking-tight">{listing.year} {listing.make} {listing.model}</h1>
                <p className="text-[13px] text-[#6B6B6B] mb-4">{listing.trim}</p>
                <p className="text-[36px] font-bold text-[#111111] mb-2">{formatPrice(listing.price)}</p>
                <div className="mb-4">
                  <DealRating id={listing.id} make={listing.make} model={listing.model} year={listing.year} price={listing.price} />
                </div>
                {inNegotiation && (
                  <div className="mb-4 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-[13px] font-semibold text-amber-800">In negotiation: {formatPrice(listing.negotiation_price as number)}</span>
                  </div>
                )}
                <p className="text-[13px] text-[#6B6B6B] mb-6 flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {listing.location}
                </p>

                {isOwner ? (
                  <div className="flex flex-col gap-2">
                    <Link href="/dashboard" className="w-full bg-[#111111] text-white text-[14px] font-semibold py-3.5 rounded-xl hover:bg-[#333] transition-colors text-center">Manage listing</Link>
                    {listing.status === 'active' && (
                      <button onClick={handleMarkSold} className="w-full border border-[#E5E5E5] text-[#111111] text-[14px] font-semibold py-3 rounded-xl hover:border-[#111111] transition-colors">Mark as sold</button>
                    )}
                  </div>
                ) : listing.status === 'sold' ? (
                  <div className="bg-[#F5F5F3] rounded-xl p-4 text-center">
                    <p className="text-[14px] font-semibold text-[#111111]">This car has been sold.</p>
                    <Link href="/browse" className="text-[13px] text-[#6B6B6B] hover:text-[#111111] underline mt-1 inline-block">Browse similar →</Link>
                  </div>
                ) : locked ? (
                  <>
                    <p className="text-[13px] text-[#6B6B6B] mb-3">This car is in negotiation. New messages are locked — you can still step in with a higher offer.</p>
                    <button onClick={() => { setOfferAmount(String(minOffer)); setOfferError(''); setOfferOpen(true) }} className="w-full bg-[#111111] text-white text-[14px] font-semibold py-3.5 rounded-xl hover:bg-[#333] transition-colors mb-2">
                      Break negotiation · offer higher
                    </button>
                    <button onClick={toggleLike} className={`w-full border text-[13px] font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 ${liked ? 'border-[#111111] text-[#111111]' : 'border-[#E5E5E5] text-[#6B6B6B] hover:border-[#111111] hover:text-[#111111]'}`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill={liked ? '#ef4444' : 'none'} stroke={liked ? '#ef4444' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                      {liked ? 'Saved' : 'Save'}{likeCount > 0 ? ` · ${likeCount}` : ''}
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={handleMessage} disabled={messaging} className="w-full bg-[#111111] text-white text-[14px] font-semibold py-3.5 rounded-xl hover:bg-[#333] transition-colors disabled:opacity-60 mb-2 flex items-center justify-center gap-2">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      {messaging ? 'Opening chat…' : isNegBuyer ? 'Continue negotiation' : 'Message seller'}
                    </button>
                    {msgError && <p className="text-[12px] text-red-600 mb-2">{msgError}</p>}
                    <button onClick={() => { if (!user) { router.push(`/auth/login?next=/listing/${listing.id}`); return } setOfferAmount(''); setOfferError(''); setOfferOpen(true) }} className="w-full border border-[#E5E5E5] text-[#111111] text-[14px] font-semibold py-3 rounded-xl hover:border-[#111111] transition-colors mb-2">
                      Make an offer
                    </button>
                    <button onClick={() => { if (!user) { router.push(`/auth/login?next=/listing/${listing.id}`); return } setInterested(true) }} className={`w-full border text-[14px] font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 ${interested ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : 'border-[#E5E5E5] text-[#111111] hover:border-[#111111]'}`}>
                      {interested ? (
                        <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> Marked as interested</>
                      ) : (
                        <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> I&apos;m interested</>
                      )}
                    </button>
                    <button onClick={toggleLike} className={`w-full border text-[13px] font-medium py-2.5 rounded-xl transition-colors mt-1 flex items-center justify-center gap-2 ${liked ? 'border-[#111111] text-[#111111]' : 'border-[#E5E5E5] text-[#6B6B6B] hover:border-[#111111] hover:text-[#111111]'}`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill={liked ? '#ef4444' : 'none'} stroke={liked ? '#ef4444' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                      {liked ? 'Saved' : 'Save'}{likeCount > 0 ? ` · ${likeCount}` : ''}
                    </button>
                  </>
                )}
              </div>

              {/* Seller card */}
              <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                <p className="text-[11px] font-semibold text-[#6B6B6B] uppercase tracking-wider mb-4">About the seller</p>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-[#111111] rounded-full flex items-center justify-center text-[13px] font-bold text-white">
                    {sellerName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[#111111]">{sellerName}</p>
                    {showEmail && (
                      <a href={`mailto:${sellerEmail}`} className="text-[12px] text-[#111111] underline hover:text-[#333] break-all">{sellerEmail}</a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5 mb-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <span className="text-[12px] font-medium text-emerald-700">Identity verified by private.</span>
                </div>
                <Link href={`/seller/${listing.seller_id}`} className="block text-center text-[13px] font-semibold text-[#111111] border border-[#E5E5E5] rounded-xl py-2.5 hover:border-[#111111] transition-colors">View seller&apos;s other cars</Link>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile sticky footer */}
        {!isOwner && listing.status === 'active' && (
          <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E5E5] p-4 z-40">
            <div className="flex gap-3 max-w-md mx-auto">
              {locked ? (
                <button onClick={() => { if (!user) { router.push(`/auth/login?next=/listing/${listing.id}`); return } setOfferAmount(String(minOffer)); setOfferError(''); setOfferOpen(true) }} className="flex-1 bg-[#111111] text-white text-[14px] font-semibold py-3.5 rounded-xl hover:bg-[#333] transition-colors">
                  Offer higher than {formatPrice(listing.negotiation_price as number)}
                </button>
              ) : (
                <>
                  <button onClick={handleMessage} disabled={messaging} className="flex-1 bg-[#111111] text-white text-[14px] font-semibold py-3.5 rounded-xl hover:bg-[#333] transition-colors disabled:opacity-60">
                    {messaging ? 'Opening…' : isNegBuyer ? 'Continue' : 'Message seller'}
                  </button>
                  <button onClick={() => { if (!user) { router.push(`/auth/login?next=/listing/${listing.id}`); return } setOfferAmount(''); setOfferError(''); setOfferOpen(true) }} className="border border-[#E5E5E5] text-[#111111] text-[14px] font-semibold px-4 py-3.5 rounded-xl hover:border-[#111111] transition-colors">
                    Offer
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <SimilarListings currentId={listing.id} make={listing.make} />
      </div>

      <footer className="border-t border-[#E5E5E5] mt-16">
        <div className="max-w-7xl mx-auto px-5 py-8 flex justify-between">
          <p className="text-[13px] text-[#6B6B6B]">© 2025 private. · Private-party cars only.</p>
          <Link href="/browse" className="text-[13px] text-[#6B6B6B] hover:text-[#111111] transition-colors">Browse all →</Link>
        </div>
      </footer>
    </div>
  )
}

function SimilarListings({ currentId, make }: { currentId: string; make: string }) {
  type SimilarListing = Pick<Listing, 'id' | 'year' | 'make' | 'model' | 'price' | 'mileage' | 'location' | 'images'>
  const [listings, setListings] = useState<SimilarListing[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('listings')
      .select('id, year, make, model, price, mileage, location, images')
      .eq('status', 'active')
      .neq('id', currentId)
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => {
        const all = data || []
        const same = all.filter((l) => l.make === make).slice(0, 3)
        setListings(same.length > 0 ? same : all.slice(0, 3))
      })
  }, [currentId, make])

  if (listings.length === 0) return null

  return (
    <div className="mt-16 pb-28 lg:pb-0">
      <h2 className="text-[20px] font-semibold text-[#111111] tracking-tight mb-6">Similar listings</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {listings.map((l) => (
          <Link key={l.id} href={`/listing/${l.id}`} className="group block">
            <div className="bg-white rounded-2xl border border-[#E5E5E5] shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.09)] transition-all overflow-hidden">
              <div className="relative overflow-hidden" style={{ aspectRatio: '4/3' }}>
                <img src={storageImage(l.images[0], { width: 480, quality: 75 }) || 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=480&q=75'} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] font-semibold text-[#111111]">{l.year} {l.make} {l.model}</p>
                  <p className="text-[14px] font-bold text-[#111111] whitespace-nowrap">{formatPrice(l.price)}</p>
                </div>
                <p className="text-[12px] text-[#6B6B6B] mt-1">{formatMileage(l.mileage)} · {l.location}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
