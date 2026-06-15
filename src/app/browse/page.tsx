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

export default function BrowsePage() {
  const [listings, setListings] = useState<ListingCard[]>([])
  const [total, setTotal] = useState(0)
  const [fetching, setFetching] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(0)

  const [query, setQuery] = useState('')
  const [make, setMake] = useState('All Makes')
  const [priceIdx, setPriceIdx] = useState(0)
  const [yearIdx, setYearIdx] = useState(0)
  const [sortIdx, setSortIdx] = useState(0)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const buildQuery = useCallback((supabase: ReturnType<typeof createClient>, offset: number) => {
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
      // Full-text search across make, model, location
      q = q.or(`make.ilike.%${query}%,model.ilike.%${query}%,trim.ilike.%${query}%,location.ilike.%${query}%`)
    }

    return q
      .order(sort.col, { ascending: sort.asc })
      .range(offset, offset + PAGE_SIZE - 1)
  }, [make, priceIdx, yearIdx, sortIdx, query])

  const fetchListings = useCallback((reset: boolean) => {
    const offset = reset ? 0 : page * PAGE_SIZE
    if (reset) {
      setFetching(true)
      setPage(0)
    } else {
      setLoadingMore(true)
    }

    const supabase = createClient()
    buildQuery(supabase, offset).then(({ data, count, error }) => {
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
  }, [buildQuery, page])

  // Re-fetch when filters change (debounce text search)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchListings(true), query ? 300 : 0)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [make, priceIdx, yearIdx, sortIdx, query])

  const clearFilters = () => {
    setMake('All Makes')
    setPriceIdx(0)
    setYearIdx(0)
    setSortIdx(0)
    setQuery('')
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
            {fetching ? 'Searching…' : `${total} private-party vehicle${total !== 1 ? 's' : ''} available`}
          </p>
        </div>

        {/* Search */}
        <div className="bg-white border border-[#E5E5E5] rounded-2xl flex items-center gap-3 px-4 py-3 mb-4 shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search make, model, location…"
            className="flex-1 bg-transparent outline-none text-[15px] text-[#111111] placeholder:text-[#6B6B6B]"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-[#6B6B6B] hover:text-[#111111]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
        ) : listings.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-4xl mb-4">🔍</p>
            <p className="text-[16px] font-medium text-[#111111] mb-2">No results found.</p>
            <p className="text-[14px] text-[#6B6B6B] mb-6">Try clearing your filters or be the first to list a car.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={clearFilters} className="bg-[#111111] text-white text-[13px] font-semibold px-6 py-2.5 rounded-full hover:bg-[#333] transition-colors">Clear filters</button>
              <Link href="/sell" className="border border-[#E5E5E5] text-[#111111] text-[13px] font-semibold px-6 py-2.5 rounded-full hover:border-[#111111] transition-colors">List your car</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map((l) => (
                <Link key={l.id} href={`/listing/${l.id}`} className="group block">
                  <div className="bg-white rounded-2xl border border-[#E5E5E5] shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] transition-all duration-300 overflow-hidden">
                    <div className="relative overflow-hidden bg-[#F5F5F3]" style={{ aspectRatio: '4/3' }}>
                      <img
                        src={l.images[0] || 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=480&q=75'}
                        alt={`${l.year} ${l.make} ${l.model}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <span className={`absolute top-3 left-3 text-[11px] font-semibold px-2.5 py-1 rounded-full ${conditionStyle[l.condition] || 'bg-gray-50 text-gray-700'}`}>{l.condition}</span>
                      <button
                        onClick={(e) => { e.preventDefault(); toggleSave(l.id) }}
                        className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-sm"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill={savedIds.has(l.id) ? '#ef4444' : 'none'} stroke={savedIds.has(l.id) ? '#ef4444' : '#6B6B6B'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                      </button>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <h3 className="text-[15px] font-semibold text-[#111111] leading-snug">{l.year} {l.make} {l.model}</h3>
                        <span className="text-[15px] font-bold text-[#111111] whitespace-nowrap shrink-0">{formatPrice(l.price)}</span>
                      </div>
                      <p className="text-[13px] text-[#6B6B6B] mb-3">{l.trim}</p>
                      <div className="flex items-center gap-2 text-[13px] text-[#6B6B6B]">
                        <span>{formatMileage(l.mileage)}</span>
                        <span className="text-[#E5E5E5]">·</span>
                        <span className="flex items-center gap-1">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          {l.location}
                        </span>
                      </div>
                      <div className="mt-3 pt-3 border-t border-[#F0F0EE] flex items-center gap-1.5">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        <span className="text-[12px] text-[#6B6B6B]">Private Seller · Verified</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
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
