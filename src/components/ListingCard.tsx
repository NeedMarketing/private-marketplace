"use client"

import { useState } from 'react'
import Link from 'next/link'
import { Listing, formatPrice, formatMileage } from '@/lib/data'

const conditionStyle: Record<string, string> = {
  'Like New': 'bg-emerald-50 text-emerald-700',
  'Excellent': 'bg-blue-50 text-blue-700',
  'Good': 'bg-amber-50 text-amber-700',
  'Fair': 'bg-orange-50 text-orange-700',
}

export default function ListingCard({ listing }: { listing: Listing }) {
  const [saved, setSaved] = useState(false)

  return (
    <Link href={`/listing/${listing.id}`} className="group block">
      <div className="bg-white rounded-2xl border border-[#E5E5E5] shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] transition-all duration-300 overflow-hidden">

        {/* Image */}
        <div className="relative overflow-hidden bg-[#F5F5F3]" style={{ aspectRatio: '4/3' }}>
          <img
            src={listing.image}
            alt={`${listing.year} ${listing.make} ${listing.model}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />

          {/* Condition badge */}
          <span className={`absolute top-3 left-3 text-[11px] font-semibold px-2.5 py-1 rounded-full ${conditionStyle[listing.condition]}`}>
            {listing.condition}
          </span>

          {/* Save button */}
          <button
            onClick={(e) => { e.preventDefault(); setSaved(!saved) }}
            className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-sm"
            aria-label="Save"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill={saved ? '#ef4444' : 'none'} stroke={saved ? '#ef4444' : '#6B6B6B'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <h3 className="text-[15px] font-semibold text-[#111111] leading-snug">
              {listing.year} {listing.make} {listing.model}
            </h3>
            <span className="text-[15px] font-bold text-[#111111] whitespace-nowrap shrink-0">
              {formatPrice(listing.price)}
            </span>
          </div>

          <p className="text-[13px] text-[#6B6B6B] mb-3">{listing.trim}</p>

          <div className="flex items-center gap-2 text-[13px] text-[#6B6B6B]">
            <span>{formatMileage(listing.mileage)}</span>
            <span className="text-[#E5E5E5]">·</span>
            <span className="flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              {listing.location}
            </span>
          </div>

          <div className="mt-3 pt-3 border-t border-[#F0F0EE] flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span className="text-[12px] text-[#6B6B6B]">Private Seller · Verified</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
