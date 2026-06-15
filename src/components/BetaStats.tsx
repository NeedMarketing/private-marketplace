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

  const items = [
    { label: 'Active members', value: stats?.members },
    { label: 'Verified buyers', value: stats?.buyers },
    { label: 'Verified private sellers', value: stats?.sellers },
    { label: 'Live listings', value: stats?.listings },
    { label: 'Messages sent', value: stats?.messages },
  ]

  return (
    <section className={variant === 'light' ? 'bg-white border border-[#E5E5E5] rounded-3xl p-8 shadow-[0_2px_16px_rgba(0,0,0,0.05)]' : ''}>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <h2 className="text-[13px] font-semibold text-[#6B6B6B] uppercase tracking-wider">Live Beta Stats</h2>
      </div>
      <p className="text-[13px] text-[#6B6B6B] mb-6">Real-time activity across private. — only verified members are counted.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {items.map((it) => (
          <div key={it.label} className="text-center sm:text-left">
            <p className="text-[28px] sm:text-[32px] font-bold text-[#111111] tracking-tight tabular-nums">
              {stats === null ? <span className="inline-block w-12 h-7 bg-[#F0F0EE] rounded animate-pulse align-middle" /> : fmt(it.value ?? 0)}
            </p>
            <p className="text-[12px] text-[#6B6B6B] mt-1">{it.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
