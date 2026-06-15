"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/context/AuthContext'
import { createClient } from '@/lib/supabase/client'
import { timeAgo } from '@/lib/utils'
import type { Conversation } from '@/lib/types'

export default function MessagesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login?next=/messages')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    supabase
      .from('conversations')
      .select('*, buyer:buyer_id(full_name), seller:seller_id(full_name)')
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false })
      .then(({ data }) => {
        setConversations(data || [])
        setFetching(false)
      })
  }, [user])

  if (loading || !user) return <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#111111] border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <Navbar />

      <div className="max-w-3xl mx-auto px-5 py-10">
        <div className="mb-8">
          <h1 className="text-[28px] font-bold text-[#111111] tracking-tight">Messages</h1>
          <p className="text-[14px] text-[#6B6B6B] mt-1">{fetching ? 'Loading…' : `${conversations.length} conversation${conversations.length !== 1 ? 's' : ''}`}</p>
        </div>

        {fetching ? (
          <div className="flex flex-col gap-2">
            {[...Array(4)].map((_, i) => <div key={i} className="bg-white border border-[#E5E5E5] rounded-2xl p-4 h-20 animate-pulse" />)}
          </div>
        ) : conversations.length === 0 ? (
          <div className="bg-white border border-[#E5E5E5] rounded-2xl p-14 text-center shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="w-16 h-16 bg-[#F5F5F3] rounded-full flex items-center justify-center mx-auto mb-5">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <h3 className="text-[16px] font-semibold text-[#111111] mb-2">No messages yet</h3>
            <p className="text-[14px] text-[#6B6B6B] mb-6 max-w-xs mx-auto">Browse listings and message a seller to start a conversation.</p>
            <Link href="/browse" className="inline-block bg-[#111111] text-white text-[13px] font-semibold px-6 py-3 rounded-full hover:bg-[#333] transition-colors">Browse listings</Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {conversations.map((c) => {
              const isBuyer = c.buyer_id === user.id
              const other = isBuyer
                ? (c.seller as unknown as { full_name: string } | undefined)?.full_name
                : (c.buyer as unknown as { full_name: string } | undefined)?.full_name

              return (
                <Link key={c.id} href={`/messages/${c.id}`} className="bg-white border border-[#E5E5E5] rounded-2xl p-4 flex items-center gap-4 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:border-transparent transition-all group">
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#F5F5F3] shrink-0">
                    <img src={c.listing_image || 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=120&q=70'} alt="" className="w-full h-full object-cover" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-[14px] font-semibold text-[#111111] truncate">{other || 'Private Seller'}</p>
                      <span className="text-[11px] text-[#6B6B6B] whitespace-nowrap shrink-0">{timeAgo(c.last_message_at)}</span>
                    </div>
                    <p className="text-[12px] text-[#6B6B6B] mb-1 flex items-center gap-1">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      {c.listing_title}
                    </p>
                    <p className="text-[13px] text-[#111111] truncate">{c.last_message}</p>
                  </div>

                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 group-hover:translate-x-0.5 transition-transform"><polyline points="9 18 15 12 9 6"/></svg>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <footer className="border-t border-[#E5E5E5] mt-16">
        <div className="max-w-7xl mx-auto px-5 py-8 flex justify-between">
          <p className="text-[13px] text-[#6B6B6B]">© 2025 private. · Private-party cars only.</p>
          <Link href="/browse" className="text-[13px] text-[#6B6B6B] hover:text-[#111111] transition-colors">Browse listings →</Link>
        </div>
      </footer>
    </div>
  )
}
