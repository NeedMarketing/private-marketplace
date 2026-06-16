"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import { formatPrice, formatMileage } from '@/lib/utils'
import type { Listing } from '@/lib/types'
import Link from 'next/link'

const PAGE_SIZE = 24

const MAKES = ['All Makes', 'Acura', 'Alfa Romeo', 'Aston Martin', 'Audi', 'Bentley', 'BMW', 'Bugatti', 'Buick', 'Cadillac', 'Chevrolet', 'Chrysler', 'Dodge', 'Ferrari', 'Fiat', 'Ford', 'GMC', 'Honda', 'Hyundai', 'Infiniti', 'Jaguar', 'Jeep', 'Kia', 'Lamborghini', 'Land Rover', 'Lexus', 'Lincoln', 'Lotus', 'Maserati', 'Mazda', 'McLaren', 'Mercedes-Benz', 'MINI', 'Mitsubishi', 'Nissan', 'Porsche', 'Ram', 'Rolls-Royce', 'Subaru', 'Tesla', 'Toyota', 'Volkswagen', 'Volvo', 'Other']
const PRICE_RANGES = [
  { label: 'Any Price', min: 0, max: undefined as number | undefined },
  { label: 'Under $20k', min: 0, max: 20000 },
  { label: '$20k – $35k', min: 20000, max: 35000 },
  { label: '$35k – $55k', min: 35000, max: 55000 },
  { label: '$55k – $80k', min: 55000, max: 80000 },
  { label: '$80k+', min: 80000, max: undefined },
]
const YEAR_RANGES = [
  { label: 'Any Year', min: undefined as number | undefined, max: undefined as number | undefined },
  { label: '2022+', min: 2022, max: undefined },
  { label: '2020 – 2021', min: 2020, max: 2021 },
  { label: '2017 – 2019', min: 2017, max: 2019 },
  { label: 'Before 2017', min: undefined, max: 2016 },
]
const SORT_OPTIONS = [
  { label: 'Newest first', col: 'created_at', asc: false },
  { label: 'Price: low → high', col: 'price', asc: true },
  { label: 'Price: high → low', col: 'price', asc: false },
  { label: 'Mileage: low → high', col: 'mileage', asc: true },
]

const conditionStyle: Record<string, string> = {
  'Like New': 'bg-emerald-50 text-emerald-700',
  'Excellent': 'bg-blue-50 text-blue-700',
  'Good': 'bg-amber-50 text-amber-700',
  'Fair': 'bg-orange-50 text-orange-700',
}

const dd = "appearance-none bg-white border border-[#E5E5E5] rounded-full px-4 py-2 pr-8 text-[13px] font-medium text-[#111111] cursor-pointer hover:border-[#111111] transition-colors outline-none"

type ListingCard = Pick<Listing, 'id' | 'year' | 'make' | 'model' | 'trim' | 'price' | 'mileage' | 'location' | 'images' | 'condition' | 'created_at'>

// Compact, Facebook-Marketplace-style card for a dense multi-column grid.
function Card({ l, saved, onToggle }: { l: ListingCard; saved: boolean; onToggle: (id: string) => void }) {
  return (
    <Link href={`/listing/${l.id}`} className="group block">
      <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-[0_1px_6px_rgba(0,0,0,0.05)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.10)] transition-all duration-200 overflow-hidden">
        <div className="relative overflow-hidden bg-[#F5F5F3]" style={{ aspectRatio: '1/1' }}>
          <img
            src={l.images[0] || 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=480&q=75'}
            alt={`${l.year} ${l.make} ${l.model}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          <button
            onClick={(e) => { e.preventDefault(); onToggle(l.id) }}
            className="absolute top-2 right-2 w-7 h-7 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-sm"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill={saved ? '#ef4444' : 'none'} stroke={saved ? '#ef4444' : '#6B6B6B'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </button>
          <span className={`absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${conditionStyle[l.condition] || 'bg-gray-50 text-gray-700'}`}>{l.condition}</span>
        </div>
        <div className="p-2.5">
          <p className="text-[15px] font-bold text-[#111111] leading-tight">{formatPrice(l.price)}</p>
          <p className="text-[13px] text-[#111111] truncate mt-0.5">{l.year} {l.make} {l.model}</p>
          <p className="text-[12px] text-[#6B6B6B] truncate mt-0.5 flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            {formatMileage(l.mileage)} · {l.location}
          </p>
        </div>
      </div>
    </Link>
  )
}

export default function BrowsePage() {
  const [listings, setListings] = useState<ListingCard[]>([])
  const [total, setTotal] = useState(0)
  const [fetching, setFetching] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(0)

  const [query, setQuery] = useState('')
  const [loc, setLoc] = useState('')
  const [make, setMake] = useState('All Makes')
  const [priceIdx, setPriceIdx] = useState(0)
  const [yearIdx, setYearIdx] = useState(0)
  const [sortIdx, setSortIdx] = useState(0)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [outside, setOutside] = useState<ListingCard[]>([])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Prefill keyword + location from the homepage search (?q= & ?loc=).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const qp = sp.get('q'); const lp = sp.get('loc')
    if (qp) setQuery(qp)
    if (lp) setLoc(lp)
  }, [])

  // locMode: 'in' = only this location, 'out' = everywhere except, 'none' = ignore location
  const buildQuery = useCallback((supabase: ReturnType<typeof createClient>, offset: number, limit: number, locMode: 'in' | 'out' | 'none') => {
    const pr = PRICE_RANGES[priceIdx]
    const yr = YEAR_RANGES[yearIdx]
    const sort = SORT_OPTIONS[sortIdx]

    let q = supabase
      .from('listings')
      .select('id, year, make, model, trim, price, mileage, location, images, condition, created_at', { count: 'exact' })
      .eq('status', 'active')

    if (make !== 'All Makes') q = q.eq('make', make)
    if (pr.min) q = q.gte('price', pr.min)
    if (pr.max) q = q.lte('price', pr.max)
    if (yr.min) q = q.gte('year', yr.min)
    if (yr.max) q = q.lte('year', yr.max)
    if (query.trim()) {
      q = q.or(`make.ilike.%${query}%,model.ilike.%${query}%,trim.ilike.%${query}%,location.ilike.%${query}%`)
    }
    const L = loc.trim()
    if (L && locMode === 'in') q = q.ilike('location', `%${L}%`)
    if (L && locMode === 'out') q = q.not('location', 'ilike', `%${L}%`)

    return q
      .order(sort.col, { ascending: sort.asc })
      .range(offset, offset + limit - 1)
  }, [make, priceIdx, yearIdx, sortIdx, query, loc])

  const fetchListings = useCallback((reset: boolean) => {
    const offset = reset ? 0 : page * PAGE_SIZE
    if (reset) {
      setFetching(true)
      setPage(0)
    } else {
      setLoadingMore(true)
    }

    const supabase = createClient()
    const hasLoc = loc.trim().length > 0
    buildQuery(supabase, offset, PAGE_SIZE, hasLoc ? 'in' : 'none').then(({ data, count, error }) => {
      if (error) { console.error(error); setFetching(false); setLoadingMore(false); return }
      if (reset) {
        setListings(data || [])
      } else {
        setListings((prev) => [...prev, ...(data || [])])
        setPage((p) => p + 1)
      }
      setTotal(count || 0)
      setFetching(false)
      setLoadingMore(false)
    })

    // When a location is set, fetch a small set of cars OUTSIDE it for the
    // "Cars outside your search" section (only on a fresh search/filter change).
    if (reset) {
      if (hasLoc) {
        buildQuery(supabase, 0, 12, 'out').then(({ data }) => setOutside(data || []))
      } else {
        setOutside([])
      }
    }
  }, [buildQuery, page, loc])

  // Re-fetch when filters change (debounce text fields)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchListings(true), (query || loc) ? 300 : 0)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [make, priceIdx, yearIdx, sortIdx, query, loc])

  const clearFilters = () => {
    setMake('All Makes')
    setPriceIdx(0)
    setYearIdx(0)
    setSortIdx(0)
    setQuery('')
    setLoc('')
  }

  const toggleSave = (id: string) => setSavedIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const hasMore = listings.length < total

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <Navbar />

      <div className="max-w-7xl mx-auto px-5 py-10">
        <div className="mb-7">
          <h1 className="text-[30px] font-bold text-[#111111] tracking-tight mb-1">Browse listings</h1>
          <p className="text-[14px] text-[#6B6B6B]">
            {fetching ? 'Searching…' : loc.trim()
              ? `${total} vehicle${total !== 1 ? 's' : ''} in ${loc.trim()}`
              : `${total} private-party vehicle${total !== 1 ? 's' : ''} available`}
          </p>
        </div>

        {/* Search — keyword + location */}
        <div className="bg-white border border-[#E5E5E5] rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-0 px-2 py-2 mb-4 shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-3 flex-1 px-3 py-1.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search make, model, keyword…"
              className="flex-1 bg-transparent outline-none text-[15px] text-[#111111] placeholder:text-[#6B6B6B]"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-[#6B6B6B] hover:text-[#111111]">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
          <div className="hidden sm:block w-px self-stretch bg-[#E5E5E5] my-1" />
          <div className="flex items-center gap-3 flex-1 px-3 py-1.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <input
              value={loc}
              onChange={(e) => setLoc(e.target.value)}
              placeholder="City or ZIP code"
              className="flex-1 bg-transparent outline-none text-[15px] text-[#111111] placeholder:text-[#6B6B6B]"
            />
            {loc && (
              <button onClick={() => setLoc('')} className="text-[#6B6B6B] hover:text-[#111111]">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>

          <div className="relative">
            <select value={make} onChange={(e) => setMake(e.target.value)} className={dd}>
              {MAKES.map((m) => <option key={m}>{m}</option>)}
            </select>
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>

          <div className="relative">
            <select value={priceIdx} onChange={(e) => setPriceIdx(Number(e.target.value))} className={dd}>
              {PRICE_RANGES.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
            </select>
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>

          <div className="relative">
            <select value={yearIdx} onChange={(e) => setYearIdx(Number(e.target.value))} className={dd}>
              {YEAR_RANGES.map((y, i) => <option key={i} value={i}>{y.label}</option>)}
            </select>
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>

          <div className="relative ml-auto">
            <select value={sortIdx} onChange={(e) => setSortIdx(Number(e.target.value))} className={dd}>
              {SORT_OPTIONS.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
            </select>
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>

        {/* Grid */}
        {fetching ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden animate-pulse">
                <div className="bg-[#F5F5F3]" style={{ aspectRatio: '4/3' }} />
                <div className="p-4 flex flex-col gap-2">
                  <div className="h-4 bg-[#F5F5F3] rounded w-3/4" />
                  <div className="h-3 bg-[#F5F5F3] rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {listings.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-4xl mb-4">🔍</p>
                {loc.trim() ? (
                  <>
                    <p className="text-[16px] font-medium text-[#111111] mb-2">No cars found in {loc.trim()}.</p>
                    <p className="text-[14px] text-[#6B6B6B] mb-6">Nothing matches that location yet{outside.length > 0 ? ' — see cars elsewhere below' : ''}, or clear the location to see everything.</p>
                  </>
                ) : (
                  <p className="text-[14px] text-[#6B6B6B] mb-6">Try clearing your filters or be the first to list a car.</p>
                )}
                <div className="flex gap-3 justify-center">
                  <button onClick={clearFilters} className="bg-[#111111] text-white text-[13px] font-semibold px-6 py-2.5 rounded-full hover:bg-[#333] transition-colors">Clear search</button>
                  <Link href="/sell" className="border border-[#E5E5E5] text-[#111111] text-[13px] font-semibold px-6 py-2.5 rounded-full hover:border-[#111111] transition-colors">List your car</Link>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                  {listings.map((l) => <Card key={l.id} l={l} saved={savedIds.has(l.id)} onToggle={toggleSave} />)}
                </div>

                {hasMore && (
                  <div className="text-center mt-10">
                    <button
                      onClick={() => { setPage((p) => p + 1); fetchListings(false) }}
                      disabled={loadingMore}
                      className="inline-flex items-center gap-2 bg-white border border-[#E5E5E5] text-[#111111] text-[14px] font-medium px-8 py-3.5 rounded-full hover:border-[#111111] transition-colors shadow-[0_2px_10px_rgba(0,0,0,0.04)] disabled:opacity-50"
                    >
                      {loadingMore ? (
                        <><div className="w-4 h-4 border-2 border-[#111111] border-t-transparent rounded-full animate-spin" /> Loading…</>
                      ) : (
                        <>Load more · {total - listings.length} remaining</>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Cars outside the searched location — clearly separated */}
            {loc.trim() && outside.length > 0 && (
              <section className="mt-14">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex-1 h-px bg-[#E5E5E5]" />
                  <h2 className="text-[13px] font-semibold text-[#6B6B6B] uppercase tracking-wider whitespace-nowrap">Cars outside {loc.trim()}</h2>
                  <div className="flex-1 h-px bg-[#E5E5E5]" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                  {outside.map((l) => <Card key={l.id} l={l} saved={savedIds.has(l.id)} onToggle={toggleSave} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <footer className="border-t border-[#E5E5E5] mt-16">
        <div className="max-w-7xl mx-auto px-5 py-8 flex justify-between">
          <p className="text-[13px] text-[#6B6B6B]">© 2025 private. · Private-party cars only.</p>
          <Link href="/sell" className="text-[13px] text-[#6B6B6B] hover:text-[#111111] transition-colors">Sell your car →</Link>
        </div>
      </footer>
    </div>
  )
}
