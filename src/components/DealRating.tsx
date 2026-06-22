"use client"

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/utils'

// Deal rating computed from private.'s OWN comparable listings — no third-party
// data. We take same make+model within ±2 model years (active or sold), find the
// median price, and rate this listing's price against it. Needs a few comparables
// to be meaningful; otherwise we say so honestly.
const MIN_COMPS = 3

type Tier = { label: string; cls: string; note: string }

function rate(ratio: number): Tier {
  if (ratio <= 0.90) return { label: 'Excellent Price', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', note: 'Well below the market average for similar cars.' }
  if (ratio <= 0.97) return { label: 'Great Price', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', note: 'Below the market average for similar cars.' }
  if (ratio <= 1.05) return { label: 'Good Price', cls: 'bg-blue-50 text-blue-700 border-blue-200', note: 'Right around the market average.' }
  if (ratio <= 1.15) return { label: 'Fair Price', cls: 'bg-amber-50 text-amber-700 border-amber-200', note: 'A little above the market average.' }
  return { label: 'Overpriced', cls: 'bg-orange-50 text-orange-700 border-orange-200', note: 'Above the market average for similar cars.' }
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export default function DealRating({ id, make, model, year, price }: { id: string; make: string; model: string; year: number; price: number }) {
  const [state, setState] = useState<{ tier: Tier; market: number; comps: number } | 'loading' | 'insufficient'>('loading')

  useEffect(() => {
    const supabase = createClient()
    const pricesOf = (data: { price: number }[] | null) =>
      (data || []).map((d) => d.price).filter((p) => typeof p === 'number' && p > 0)
    const base = () => supabase
      .from('listings').select('price')
      .eq('make', make).eq('model', model)
      .in('status', ['active', 'sold']).neq('id', id)

    const run = async () => {
      // Widen the comparable window in tiers until we have enough data points.
      let prices = pricesOf((await base().gte('year', year - 2).lte('year', year + 2)).data)
      if (prices.length < MIN_COMPS) prices = pricesOf((await base().gte('year', year - 5).lte('year', year + 5)).data)
      if (prices.length < MIN_COMPS) prices = pricesOf((await base()).data) // any year, same model

      if (prices.length < MIN_COMPS) { setState('insufficient'); return }
      const market = median(prices)
      if (market <= 0) { setState('insufficient'); return }
      setState({ tier: rate(price / market), market, comps: prices.length })
    }
    run()
  }, [id, make, model, year, price])

  if (state === 'loading') {
    return <div className="h-9 w-40 bg-[#F0F0EE] rounded-full animate-pulse" />
  }

  if (state === 'insufficient') {
    return (
      <div className="inline-flex items-center gap-2 border border-[#E5E5E5] bg-[#F5F5F3] rounded-full px-3.5 py-1.5">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
        <span className="text-[12px] font-medium text-[#6B6B6B]">Building market data for this model</span>
      </div>
    )
  }

  const { tier, market, comps } = state
  return (
    <div className={`inline-flex flex-col rounded-2xl border px-4 py-2.5 ${tier.cls}`}>
      <div className="flex items-center gap-1.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        <span className="text-[13px] font-bold">{tier.label}</span>
      </div>
      <span className="text-[11px] opacity-80 mt-0.5">{tier.note} Est. market value ≈ {formatPrice(Math.round(market))} based on {comps} comparable{comps !== 1 ? 's' : ''} on private.</span>
    </div>
  )
}
