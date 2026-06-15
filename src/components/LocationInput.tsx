"use client"

import { useState, useRef, useEffect } from 'react'
import { US_CITIES } from '@/lib/us-cities'

// Free-text location field with US-city autocomplete suggestions. Any value can
// still be typed even if it's not in the suggestion list.
export default function LocationInput({
  value,
  onChange,
  className = '',
  placeholder = 'e.g. Los Angeles, CA',
}: {
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  const q = value.trim().toLowerCase()
  const matches = q.length === 0
    ? []
    : US_CITIES.filter((c) => c.toLowerCase().includes(q)).slice(0, 6)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const choose = (city: string) => { onChange(city); setOpen(false) }

  return (
    <div ref={wrapRef} className="relative">
      <input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(0) }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || matches.length === 0) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, matches.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
          else if (e.key === 'Enter' && matches[active]) { e.preventDefault(); choose(matches[active]) }
          else if (e.key === 'Escape') setOpen(false)
        }}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {open && matches.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-[#E5E5E5] rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] py-1.5 max-h-60 overflow-y-auto">
          {matches.map((c, i) => (
            <button
              key={c}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); choose(c) }}
              onMouseEnter={() => setActive(i)}
              className={`w-full text-left px-4 py-2 text-[14px] flex items-center gap-2 ${i === active ? 'bg-[#F5F5F3]' : ''} text-[#111111]`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
