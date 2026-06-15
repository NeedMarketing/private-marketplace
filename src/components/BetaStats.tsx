"use client"

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Stats = {
  members: number
  buyers: number
  sellers: number
  listings: number
  messages: number
}

const fmt = (n: number) => n.toLocaleString('en-US')

export default function BetaStats({ variant = 'light' }: { variant?: 'light' | 'plain' }) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.rpc('beta_stats').then(({ data, error }) => {
      if (error || !data) { console.error('beta_stats failed:', error); setFailed(true); return }
      setStats(data as Stats)
    })
  }, [])

  // Never render fake/placeholder numbers — if the call fails, hide the section.
  if (failed) return null

  return (
    <section className={variant === 'light' ? 'bg-white border border-[#E5E5E5] rounded-3xl p-8 shadow-[0_2px_16px_rgba(0,0,0,0.05)] text-center' : 'text-center'}>
      <div className="flex items-center justify-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <h2 className="text-[13px] font-semibold text-[#6B6B6B] uppercase tracking-wider">Active members</h2>
      </div>
      <p className="text-[48px] sm:text-[56px] font-bold text-[#111111] tracking-tight tabular-nums leading-none">
        {stats === null ? <span className="inline-block w-24 h-12 bg-[#F0F0EE] rounded animate-pulse align-middle" /> : fmt(stats.members)}
      </p>
      <p className="text-[13px] text-[#6B6B6B] mt-3">Verified members on private. — only email/phone-verified accounts are counted.</p>
    </section>
  )
}
