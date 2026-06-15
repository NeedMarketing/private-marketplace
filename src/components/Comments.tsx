"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { createClient } from '@/lib/supabase/client'
import { timeAgo } from '@/lib/utils'

type Comment = {
  id: string
  user_id: string
  author_name: string
  text: string
  created_at: string
}

export default function Comments({ listingId }: { listingId: string }) {
  const { user, profile } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('listing_comments')
      .select('id, user_id, author_name, text, created_at')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: true })
      .then(({ data }) => { setComments(data || []); setLoading(false) })
  }, [listingId])

  const submit = async () => {
    const body = text.trim()
    if (!body || !user || posting) return
    setPosting(true)
    setError('')
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('listing_comments')
      .insert({ listing_id: listingId, user_id: user.id, author_name: profile?.full_name || 'Member', text: body })
      .select('id, user_id, author_name, text, created_at')
      .single()
    if (err || !data) { console.error('Comment failed:', err); setError(err?.message || 'Could not post your comment.'); setPosting(false); return }
    setComments((prev) => [...prev, data])
    setText('')
    setPosting(false)
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this comment?')) return
    const supabase = createClient()
    const { error: err } = await supabase.from('listing_comments').delete().eq('id', id)
    if (err) { alert(err.message); return }
    setComments((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] mb-5">
      <h2 className="text-[15px] font-semibold text-[#111111] mb-4">
        Comments{!loading && comments.length > 0 ? ` (${comments.length})` : ''}
      </h2>

      {loading ? (
        <p className="text-[13px] text-[#6B6B6B]">Loading…</p>
      ) : comments.length === 0 ? (
        <p className="text-[13px] text-[#6B6B6B] mb-4">No comments yet. Be the first to ask a question.</p>
      ) : (
        <div className="flex flex-col gap-4 mb-5">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-[#111111] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                {(c.author_name || 'M').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-semibold text-[#111111]">{c.author_name || 'Member'}</p>
                  <span className="text-[11px] text-[#6B6B6B]">{timeAgo(c.created_at)}</span>
                  {user?.id === c.user_id && (
                    <button onClick={() => remove(c.id)} className="text-[11px] text-[#6B6B6B] hover:text-red-500 ml-auto">Delete</button>
                  )}
                </div>
                <p className="text-[14px] text-[#111111] leading-relaxed mt-0.5 break-words whitespace-pre-wrap">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {user ? (
        <div className="flex flex-col gap-2 pt-2 border-t border-[#F0F0EE]">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ask a question or leave a comment…"
            rows={2}
            className="w-full border border-[#E5E5E5] rounded-xl px-3 py-2.5 text-[14px] text-[#111111] placeholder:text-[#6B6B6B] outline-none focus:border-[#111111] transition-colors resize-none"
          />
          {error && <p className="text-[12px] text-red-600">{error}</p>}
          <div className="flex justify-end">
            <button onClick={submit} disabled={posting || !text.trim()} className="bg-[#111111] text-white text-[13px] font-semibold px-5 py-2.5 rounded-full hover:bg-[#333] transition-colors disabled:opacity-50">
              {posting ? 'Posting…' : 'Post comment'}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[13px] text-[#6B6B6B] pt-2 border-t border-[#F0F0EE]">
          <Link href={`/auth/login?next=/listing/${listingId}`} className="font-semibold text-[#111111] underline">Sign in</Link> to leave a comment.
        </p>
      )}
    </div>
  )
}
