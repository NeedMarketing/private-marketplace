"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/context/AuthContext'
import { createClient } from '@/lib/supabase/client'
import { formatPrice, formatMileage, timeAgo } from '@/lib/utils'
import type { Listing, Conversation } from '@/lib/types'

const inp = "w-full border border-[#E5E5E5] rounded-xl px-4 py-3 text-[14px] text-[#111111] placeholder:text-[#6B6B6B] outline-none focus:border-[#111111] transition-colors bg-white"

type Tab = 'listings' | 'messages' | 'profile'

function ConditionDot({ c }: { c: string }) {
  const map: Record<string, string> = { 'Like New': 'bg-emerald-400', 'Excellent': 'bg-blue-400', 'Good': 'bg-amber-400', 'Fair': 'bg-orange-400' }
  return <span className={`inline-block w-2 h-2 rounded-full ${map[c] || 'bg-gray-400'}`} />
}

function EditModal({ listing, onSave, onClose }: { listing: Listing; onSave: (l: Listing) => void; onClose: () => void }) {
  const [form, setForm] = useState({ price: String(listing.price), mileage: String(listing.mileage), description: listing.description, condition: listing.condition })
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSave = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('listings')
      .update({ price: Number(form.price), mileage: Number(form.mileage), description: form.description, condition: form.condition })
      .eq('id', listing.id)
      .select('id, seller_id, year, make, model, trim, price, mileage, location, condition, title_status, color, interior_color, transmission, fuel_type, vin, description, images, contact_preference, status, created_at, updated_at')
      .single()
    if (data) onSave(data)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.18)] w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-[#E5E5E5]">
          <h3 className="text-[16px] font-semibold text-[#111111]">Edit listing</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-[#F5F5F3] flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-[#111111] mb-1.5">Asking price</label>
              <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[#6B6B6B]">$</span><input value={form.price} onChange={(e) => set('price', e.target.value)} type="number" className={inp + ' pl-7'} /></div>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#111111] mb-1.5">Mileage</label>
              <input value={form.mileage} onChange={(e) => set('mileage', e.target.value)} type="number" className={inp} />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#111111] mb-1.5">Condition</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['Like New', 'Excellent', 'Good', 'Fair'] as Listing['condition'][]).map((c) => (
                <button key={c} onClick={() => set('condition', c)} className={`py-2 text-[12px] font-medium rounded-lg border transition-all ${form.condition === c ? 'bg-[#111111] text-white border-[#111111]' : 'bg-white text-[#111111] border-[#E5E5E5] hover:border-[#111111]'}`}>{c}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#111111] mb-1.5">Description</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} className={inp + ' resize-none'} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-[#E5E5E5] text-[14px] font-medium text-[#6B6B6B] hover:border-[#111111] transition-colors">Cancel</button>
            <button onClick={handleSave} className="flex-1 py-3 rounded-xl bg-[#111111] text-white text-[14px] font-semibold hover:bg-[#333] transition-colors">Save changes</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MyListingCard({ listing, onEdit, onDelete, onMarkSold }: { listing: Listing; onEdit: () => void; onDelete: () => void; onMarkSold: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.05)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.09)] transition-all">
      <div className="relative" style={{ aspectRatio: '16/9' }}>
        <img src={listing.images[0] || 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=480&q=75'} alt="" className="w-full h-full object-cover" />
        <span className={`absolute top-3 left-3 text-[11px] font-semibold px-2.5 py-1 rounded-full ${listing.status === 'sold' ? 'bg-[#111111] text-white' : 'bg-white text-[#111111]'}`}>
          {listing.status === 'sold' ? 'Sold' : 'Active'}
        </span>
        <div className="absolute top-3 right-3 relative">
          <button onClick={() => setMenuOpen(!menuOpen)} className="w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#111111"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-10 bg-white border border-[#E5E5E5] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] w-44 py-1.5 z-20">
              <Link href={`/listing/${listing.id}`} onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-[13px] text-[#111111] hover:bg-[#F5F5F3]">View listing</Link>
              {listing.status === 'active' && <button onClick={() => { setMenuOpen(false); onEdit() }} className="w-full text-left px-4 py-2.5 text-[13px] text-[#111111] hover:bg-[#F5F5F3]">Edit listing</button>}
              {listing.status === 'active' && <button onClick={() => { setMenuOpen(false); onMarkSold() }} className="w-full text-left px-4 py-2.5 text-[13px] text-[#111111] hover:bg-[#F5F5F3]">Mark as sold</button>}
              <button onClick={() => { setMenuOpen(false); onDelete() }} className="w-full text-left px-4 py-2.5 text-[13px] text-red-500 hover:bg-red-50">Delete listing</button>
            </div>
          )}
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[14px] font-semibold text-[#111111]">{listing.year} {listing.make} {listing.model}</h3>
          <span className="text-[14px] font-bold text-[#111111] whitespace-nowrap">{formatPrice(listing.price)}</span>
        </div>
        <div className="flex items-center gap-2 mt-1.5 text-[12px] text-[#6B6B6B]">
          <ConditionDot c={listing.condition} />
          <span>{listing.condition}</span>
          <span>·</span>
          <span>{formatMileage(listing.mileage)}</span>
          <span>·</span>
          <span>{timeAgo(listing.created_at)}</span>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user, profile, loading, updateProfile } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('listings')
  const [myListings, setMyListings] = useState<Listing[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [editTarget, setEditTarget] = useState<Listing | null>(null)
  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '' })
  const [profileSaved, setProfileSaved] = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login')
  }, [user, loading, router])

  useEffect(() => {
    if (profile) setProfileForm({ full_name: profile.full_name, phone: profile.phone || '' })
  }, [profile])

  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    Promise.all([
      supabase.from('listings').select('id, seller_id, year, make, model, trim, price, mileage, location, condition, title_status, color, interior_color, transmission, fuel_type, vin, description, images, contact_preference, status, created_at, updated_at').eq('seller_id', user.id).order('created_at', { ascending: false }),
      supabase.from('conversations').select('id, listing_id, buyer_id, seller_id, listing_title, listing_image, last_message, last_message_at, buyer:buyer_id(full_name), seller:seller_id(full_name)').or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`).order('last_message_at', { ascending: false }),
    ]).then(([{ data: listings }, { data: convs }]) => {
      setMyListings(listings || [])
      setConversations(convs || [])
      setFetching(false)
    })
  }, [user])

  if (loading || !user) return <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#111111] border-t-transparent rounded-full animate-spin" /></div>

  const handleDeleteListing = async (id: string) => {
    if (!confirm('Delete this listing?')) return
    const supabase = createClient()
    await supabase.from('listings').delete().eq('id', id)
    setMyListings((prev) => prev.filter((l) => l.id !== id))
  }

  const handleMarkSold = async (id: string) => {
    if (!confirm('Mark this car as sold?')) return
    const supabase = createClient()
    const { data } = await supabase.from('listings').update({ status: 'sold' }).eq('id', id).select('id, status, updated_at').single()
    if (data) setMyListings((prev) => prev.map((l) => l.id === id ? { ...l, status: 'sold' as const, updated_at: data.updated_at } : l))
  }

  const handleSaveProfile = async () => {
    await updateProfile({ full_name: profileForm.full_name, phone: profileForm.phone })
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 2000)
  }

  const firstName = profile?.full_name?.split(' ')[0] || ''

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'listings', label: 'My listings', count: myListings.length },
    { id: 'messages', label: 'Messages', count: conversations.length },
    { id: 'profile', label: 'Profile' },
  ]

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <Navbar />

      {editTarget && (
        <EditModal
          listing={editTarget}
          onSave={(updated) => setMyListings((prev) => prev.map((l) => l.id === updated.id ? updated : l))}
          onClose={() => setEditTarget(null)}
        />
      )}

      <div className="max-w-7xl mx-auto px-5 py-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-[28px] font-bold text-[#111111] tracking-tight">Hey, {firstName || 'there'}.</h1>
            <p className="text-[14px] text-[#6B6B6B] mt-1">{user.email} · {profile?.user_type === 'buyer' ? 'Buyer' : profile?.user_type === 'seller' ? 'Seller' : 'Buyer & Seller'}</p>
          </div>
          <Link href="/sell" className="bg-[#111111] text-white text-[13px] font-semibold px-5 py-2.5 rounded-full hover:bg-[#333] transition-colors flex items-center gap-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New listing
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-[#E5E5E5] rounded-full p-1 mb-8 w-fit">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[13px] font-medium transition-all ${tab === t.id ? 'bg-[#111111] text-white' : 'text-[#6B6B6B] hover:text-[#111111]'}`}>
              {t.label}
              {t.count !== undefined && t.count > 0 && <span className={`text-[11px] font-bold w-4 h-4 rounded-full flex items-center justify-center ${tab === t.id ? 'bg-white/20' : 'bg-[#F0F0EE]'}`}>{t.count}</span>}
            </button>
          ))}
        </div>

        {/* My Listings */}
        {tab === 'listings' && (
          <div>
            {fetching ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden animate-pulse"><div className="bg-[#F5F5F3]" style={{ aspectRatio: '16/9' }} /><div className="p-4 h-16" /></div>)}
              </div>
            ) : myListings.length === 0 ? (
              <div className="bg-white border border-[#E5E5E5] rounded-2xl p-12 text-center shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                <div className="w-14 h-14 bg-[#F5F5F3] rounded-full flex items-center justify-center mx-auto mb-5">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                </div>
                <h3 className="text-[16px] font-semibold text-[#111111] mb-2">No listings yet</h3>
                <p className="text-[14px] text-[#6B6B6B] mb-6">List your car for free and reach serious buyers.</p>
                <Link href="/sell" className="inline-block bg-[#111111] text-white text-[13px] font-semibold px-6 py-3 rounded-full hover:bg-[#333] transition-colors">List your car</Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {myListings.map((l) => (
                  <MyListingCard key={l.id} listing={l}
                    onEdit={() => setEditTarget(l)}
                    onDelete={() => handleDeleteListing(l.id)}
                    onMarkSold={() => handleMarkSold(l.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        {tab === 'messages' && (
          <div>
            {fetching ? (
              <div className="flex flex-col gap-3">
                {[...Array(3)].map((_, i) => <div key={i} className="bg-white border border-[#E5E5E5] rounded-2xl p-4 h-20 animate-pulse" />)}
              </div>
            ) : conversations.length === 0 ? (
              <div className="bg-white border border-[#E5E5E5] rounded-2xl p-12 text-center shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                <div className="w-14 h-14 bg-[#F5F5F3] rounded-full flex items-center justify-center mx-auto mb-5">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </div>
                <h3 className="text-[16px] font-semibold text-[#111111] mb-2">No messages yet</h3>
                <p className="text-[14px] text-[#6B6B6B]">When you message a seller or receive one, it will appear here.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {conversations.map((c) => {
                  const isBuyer = c.buyer_id === user.id
                  const otherParty = isBuyer
                    ? (c.seller as unknown as { full_name: string } | undefined)?.full_name
                    : (c.buyer as unknown as { full_name: string } | undefined)?.full_name
                  return (
                    <Link key={c.id} href={`/messages/${c.id}`} className="bg-white border border-[#E5E5E5] rounded-2xl p-4 flex items-center gap-4 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#F5F5F3] shrink-0">
                        <img src={c.listing_image || 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=120&q=70'} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className="text-[14px] font-semibold text-[#111111] truncate">{otherParty || 'Private Seller'}</p>
                          <span className="text-[11px] text-[#6B6B6B] whitespace-nowrap">{timeAgo(c.last_message_at)}</span>
                        </div>
                        <p className="text-[12px] text-[#6B6B6B] truncate">{c.listing_title}</p>
                        <p className="text-[13px] text-[#111111] truncate mt-0.5">{c.last_message}</p>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Profile */}
        {tab === 'profile' && (
          <div className="max-w-md">
            <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[#F0F0EE]">
                <div className="w-14 h-14 bg-[#111111] rounded-full flex items-center justify-center text-[18px] font-bold text-white">
                  {(profile?.full_name || '').split(' ').filter(Boolean).map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                </div>
                <div>
                  <p className="text-[16px] font-semibold text-[#111111]">{profile?.full_name || user.email}</p>
                  <p className="text-[13px] text-[#6B6B6B]">Member since {new Date(user.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-[13px] font-semibold text-[#111111] mb-1.5">Full name</label>
                  <input value={profileForm.full_name} onChange={(e) => setProfileForm((f) => ({ ...f, full_name: e.target.value }))} className={inp} />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-[#111111] mb-1.5">Phone</label>
                  <input value={profileForm.phone} onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))} className={inp} />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-[#111111] mb-1.5">Email</label>
                  <input value={user.email || ''} disabled className={inp + ' opacity-50 cursor-not-allowed'} />
                </div>
                <button onClick={handleSaveProfile} className={`w-full py-3.5 rounded-xl text-[14px] font-semibold transition-colors ${profileSaved ? 'bg-emerald-600 text-white' : 'bg-[#111111] text-white hover:bg-[#333]'}`}>
                  {profileSaved ? '✓ Saved' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        )}
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
