"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/context/AuthContext'
import { createClient } from '@/lib/supabase/client'
import { formatPrice, formatMileage } from '@/lib/utils'
import type { Listing } from '@/lib/types'

function SearchBar() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [loc, setLoc] = useState('')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (loc) p.set('loc', loc)
    router.push(`/browse?${p}`)
  }
  return (
    <form onSubmit={submit} className="bg-white border border-[#E5E5E5] rounded-2xl shadow-[0_2px_16px_rgba(0,0,0,0.07)] flex flex-col sm:flex-row overflow-hidden p-2 gap-2 sm:gap-0">
      <div className="flex items-center gap-3 flex-1 px-4 py-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search make, model, or keyword…" className="flex-1 bg-transparent outline-none text-[15px] text-[#111111] placeholder:text-[#6B6B6B]" />
      </div>
      <div className="hidden sm:block w-px bg-[#E5E5E5] my-2" />
      <div className="flex items-center gap-3 flex-1 px-4 py-3">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="City or ZIP code" className="flex-1 bg-transparent outline-none text-[15px] text-[#111111] placeholder:text-[#6B6B6B]" />
      </div>
      <button type="submit" className="bg-[#111111] text-white text-[14px] font-semibold px-7 py-3.5 rounded-xl hover:bg-[#333] transition-colors m-1 whitespace-nowrap">Search</button>
    </form>
  )
}

function WaitlistSection() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  return (
    <section className="max-w-7xl mx-auto px-5 pb-20">
      <div className="text-center">
        <h2 className="text-[26px] font-semibold text-[#111111] mb-3 tracking-tight">Stay in the loop.</h2>
        <p className="text-[15px] text-[#6B6B6B] mb-8">Get notified when new listings match what you&apos;re searching for.</p>
        {done
          ? <p className="text-[15px] font-semibold text-[#111111]">✓ You&apos;re on the list.</p>
          : (
            <form onSubmit={(e) => { e.preventDefault(); if (email) setDone(true) }} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className="flex-1 bg-white border border-[#E5E5E5] rounded-full px-5 py-3.5 text-[14px] text-[#111111] placeholder:text-[#6B6B6B] outline-none focus:border-[#111111] transition-colors" />
              <button type="submit" className="bg-[#111111] text-white text-[14px] font-semibold px-7 py-3.5 rounded-full hover:bg-[#333] transition-colors whitespace-nowrap">Join waitlist</button>
            </form>
          )}
      </div>
    </section>
  )
}

const trustBadges = ['Private Seller Only', 'Identity Verified', 'VIN Validated', 'No Dealerships']

const whyCards = [
  { emoji: '🛡️', title: 'No Dealerships', body: 'Only verified private sellers. Zero dealer listings, ever. If it\'s here, a real person owns it.' },
  { emoji: '✓', title: 'Verified Sellers', body: 'Every seller is identity verified before listing. Buy with confidence knowing who you\'re dealing with.' },
  { emoji: '✨', title: 'Clean Listings', body: 'No spam. No bots. No recycled dealer inventory dressed up as private sales.' },
  { emoji: '🔒', title: 'Built for Trust', body: 'Secure in-app messaging, VIN validation, and scam protection built into every transaction.' },
]

const buyerSteps = [
  { n: '01', title: 'Search listings near you', body: 'Browse private-party cars filtered by make, model, price, and distance.' },
  { n: '02', title: 'Filter to what matters', body: 'Year, mileage, condition — no dealer noise in your results.' },
  { n: '03', title: 'Message the seller directly', body: 'All comms happen inside private. Secure, organized, scam-protected.' },
  { n: '04', title: 'Meet safely and drive away', body: 'Follow our meeting guides, then enjoy your new car.' },
]
const sellerSteps = [
  { n: '01', title: 'Enter your vehicle details', body: 'VIN lookup auto-fills the basics. Add photos and your description.' },
  { n: '02', title: 'Upload your photos', body: 'Great photos sell cars. We guide you through exactly what to capture.' },
  { n: '03', title: 'Set your price', body: 'We show market comps so you price with confidence.' },
  { n: '04', title: 'Connect with serious buyers', body: 'Verified buyers only, with real intent to purchase.' },
]

export default function HomePage() {
  const { user, profile } = useAuth()
  const [featured, setFeatured] = useState<Listing[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('listings')
      .select('id, year, make, model, trim, price, mileage, location, images, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => setFeatured(data || []))
  }, [])

  const firstName = profile?.full_name?.split(' ')[0] || ''

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <Navbar />

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-5 pt-20 pb-10 text-center">
        <div className="inline-flex items-center gap-2 bg-white border border-[#E5E5E5] rounded-full px-4 py-2 mb-8 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#111111"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <span className="text-[13px] font-medium text-[#111111]">Private-party only · No dealerships · Ever.</span>
        </div>

        <h1 className="text-[48px] sm:text-[62px] font-bold text-[#111111] leading-[1.05] tracking-tight mb-6 max-w-3xl mx-auto">
          The private way to buy and sell cars.
        </h1>
        <p className="text-[17px] text-[#6B6B6B] max-w-xl mx-auto leading-relaxed mb-10">
          private. is a marketplace for private-party vehicles only — no dealerships, no spam listings, no middlemen.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-14">
          <Link href="/browse" className="bg-[#111111] text-white text-[15px] font-semibold px-8 py-4 rounded-full hover:bg-[#333] transition-colors">Browse cars</Link>
          {user ? (
            <Link href="/sell" className="bg-white border border-[#E5E5E5] text-[#111111] text-[15px] font-semibold px-8 py-4 rounded-full hover:border-[#111111] transition-colors">List your car</Link>
          ) : (
            <Link href="/auth/signup" className="bg-white border border-[#E5E5E5] text-[#111111] text-[15px] font-semibold px-8 py-4 rounded-full hover:border-[#111111] transition-colors">Create free account</Link>
          )}
        </div>

        <div className="max-w-2xl mx-auto"><SearchBar /></div>

        <div className="flex flex-wrap gap-3 justify-center mt-8">
          {trustBadges.map((b) => (
            <div key={b} className="flex items-center gap-2 bg-white border border-[#E5E5E5] rounded-full px-4 py-2 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <span className="text-[13px] font-medium text-[#111111]">{b}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Listings */}
      {featured.length > 0 && (
        <section className="max-w-7xl mx-auto px-5 py-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-[24px] font-semibold text-[#111111] tracking-tight">Featured listings</h2>
              <p className="text-[13px] text-[#6B6B6B] mt-1">Hand-picked private-party vehicles</p>
            </div>
            <Link href="/browse" className="hidden sm:flex items-center gap-1.5 text-[13px] font-medium text-[#111111] hover:opacity-60 transition-opacity">
              View all <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featured.map((l) => (
              <Link key={l.id} href={`/listing/${l.id}`} className="group block">
                <div className="bg-white rounded-2xl border border-[#E5E5E5] shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] transition-all duration-300 overflow-hidden">
                  <div className="relative overflow-hidden bg-[#F5F5F3]" style={{ aspectRatio: '4/3' }}>
                    <img src={l.images[0] || 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=480&q=75'} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <h3 className="text-[15px] font-semibold text-[#111111]">{l.year} {l.make} {l.model}</h3>
                      <span className="text-[15px] font-bold text-[#111111] whitespace-nowrap shrink-0">{formatPrice(l.price)}</span>
                    </div>
                    <p className="text-[13px] text-[#6B6B6B] mb-3">{l.trim}</p>
                    <div className="flex items-center gap-2 text-[13px] text-[#6B6B6B]">
                      <span>{formatMileage(l.mileage)}</span>
                      <span className="text-[#E5E5E5]">·</span>
                      <span>{l.location}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="/browse" className="inline-flex items-center gap-2 bg-white border border-[#E5E5E5] text-[#111111] text-[14px] font-medium px-6 py-3 rounded-full hover:border-[#111111] transition-colors shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
              See all listings <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
          </div>
        </section>
      )}

      {/* Why private. */}
      <section className="max-w-7xl mx-auto px-5 py-20">
        <div className="text-center mb-14">
          <h2 className="text-[32px] font-semibold text-[#111111] tracking-tight mb-4">Why private.</h2>
          <p className="text-[16px] text-[#6B6B6B] max-w-lg mx-auto leading-relaxed">We built the marketplace we always wanted — one that actually puts buyers and sellers first.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {whyCards.map((c) => (
            <div key={c.title} className="bg-white border border-[#E5E5E5] rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.09)] transition-all duration-300">
              <div className="w-10 h-10 bg-[#F5F5F3] rounded-xl flex items-center justify-center mb-4 text-xl">{c.emoji}</div>
              <h3 className="text-[15px] font-semibold text-[#111111] mb-2">{c.title}</h3>
              <p className="text-[14px] text-[#6B6B6B] leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-white border-y border-[#E5E5E5]">
        <div className="max-w-7xl mx-auto px-5 py-20">
          <div className="text-center mb-14">
            <h2 className="text-[32px] font-semibold text-[#111111] tracking-tight mb-4">How it works</h2>
            <p className="text-[16px] text-[#6B6B6B] max-w-md mx-auto leading-relaxed">Simple for buyers. Simple for sellers.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-12 max-w-4xl mx-auto">
            {[{ label: 'For Buyers', steps: buyerSteps }, { label: 'For Sellers', steps: sellerSteps }].map(({ label, steps }) => (
              <div key={label}>
                <div className="inline-block text-[11px] font-semibold uppercase tracking-widest text-[#6B6B6B] mb-6 border border-[#E5E5E5] rounded-full px-4 py-1.5">{label}</div>
                <div className="flex flex-col gap-6">
                  {steps.map((s) => (
                    <div key={s.n} className="flex gap-4">
                      <span className="text-[11px] font-bold text-[#6B6B6B] pt-0.5 w-6 shrink-0">{s.n}</span>
                      <div>
                        <p className="text-[15px] font-semibold text-[#111111] mb-1">{s.title}</p>
                        <p className="text-[14px] text-[#6B6B6B] leading-relaxed">{s.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-5 py-20">
        <div className="bg-[#111111] rounded-3xl p-10 sm:p-16 text-center">
          {user && firstName ? (
            <>
              <h2 className="text-[28px] font-bold text-white tracking-tight mb-4">Welcome back, {firstName}.</h2>
              <p className="text-[16px] text-white/65 max-w-md mx-auto mb-8">Got a car to sell? List it in minutes.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/sell" className="inline-block bg-white text-[#111111] text-[15px] font-semibold px-8 py-4 rounded-full hover:bg-[#F5F5F3] transition-colors">List your car →</Link>
                <Link href="/browse" className="inline-block bg-white/10 text-white text-[15px] font-semibold px-8 py-4 rounded-full hover:bg-white/20 transition-colors">Browse cars</Link>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-[28px] font-bold text-white tracking-tight mb-4">Ready to buy or sell?</h2>
              <p className="text-[16px] text-white/65 max-w-md mx-auto mb-8">Create a free account and join thousands of private buyers and sellers.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/auth/signup" className="inline-block bg-white text-[#111111] text-[15px] font-semibold px-8 py-4 rounded-full hover:bg-[#F5F5F3] transition-colors">Create free account →</Link>
                <Link href="/browse" className="inline-block bg-white/10 text-white text-[15px] font-semibold px-8 py-4 rounded-full hover:bg-white/20 transition-colors">Browse listings</Link>
              </div>
            </>
          )}
        </div>
      </section>

      <WaitlistSection />

      {/* Footer */}
      <footer className="border-t border-[#E5E5E5]">
        <div className="max-w-7xl mx-auto px-5 py-14">
          <div className="flex flex-col md:flex-row justify-between gap-10 mb-12">
            <div className="max-w-xs">
              <p className="text-xl font-bold text-[#111111] mb-3">private.</p>
              <p className="text-[14px] text-[#6B6B6B] leading-relaxed">The premium marketplace for private-party vehicle sales. No dealerships. No middlemen.</p>
            </div>
            <div className="grid grid-cols-3 gap-8 text-[14px]">
              {[
                { heading: 'Marketplace', links: [['Browse', '/browse'], ['Sell your car', '/sell']] },
                { heading: 'Company', links: [['How it works', '#how-it-works'], ['Safety', '#'], ['About', '#']] },
                { heading: 'Account', links: [['Sign in', '/auth/login'], ['Create account', '/auth/signup'], ['Dashboard', '/dashboard']] },
              ].map(({ heading, links }) => (
                <div key={heading} className="flex flex-col gap-3">
                  <span className="text-[12px] font-semibold text-[#111111] uppercase tracking-wider">{heading}</span>
                  {links.map(([label, href]) => <Link key={label} href={href} className="text-[#6B6B6B] hover:text-[#111111] transition-colors">{label}</Link>)}
                </div>
              ))}
            </div>
          </div>
          <div className="pt-8 border-t border-[#E5E5E5] flex flex-col sm:flex-row justify-between gap-2">
            <p className="text-[13px] text-[#6B6B6B]">© 2025 private. · Private-party cars only.</p>
            <p className="text-[13px] text-[#6B6B6B]">Made for buyers and sellers, not dealers.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
