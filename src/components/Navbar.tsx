"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

export default function Navbar() {
  const { user, profile, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const handleLogout = async () => {
    setProfileOpen(false)
    await logout()
    router.push('/')
  }

  const displayName = profile?.full_name || user?.email || ''
  const initials = displayName.split(' ').filter(Boolean).map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?'

  return (
    <nav className="sticky top-0 z-50 bg-[#FAFAF7]/95 backdrop-blur-sm border-b border-[#E5E5E5]">
      <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="text-xl font-bold text-[#111111] tracking-tight hover:opacity-60 transition-opacity">
          private.
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-7">
          <Link href="/browse" className={`text-[14px] font-medium transition-colors ${pathname === '/browse' ? 'text-[#111111]' : 'text-[#6B6B6B] hover:text-[#111111]'}`}>Browse</Link>
          <Link href="/sell" className={`text-[14px] font-medium transition-colors ${pathname === '/sell' ? 'text-[#111111]' : 'text-[#6B6B6B] hover:text-[#111111]'}`}>Sell</Link>
          <Link href="/#how-it-works" className="text-[14px] font-medium text-[#6B6B6B] hover:text-[#111111] transition-colors">How it works</Link>
          {user && (
            <Link href="/messages" className={`text-[14px] font-medium transition-colors ${pathname.startsWith('/messages') ? 'text-[#111111]' : 'text-[#6B6B6B] hover:text-[#111111]'}`}>Messages</Link>
          )}
        </div>

        {/* Desktop right side */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2.5 bg-white border border-[#E5E5E5] rounded-full pl-1 pr-4 py-1 hover:border-[#111111] transition-colors"
              >
                <div className="w-7 h-7 bg-[#111111] rounded-full flex items-center justify-center text-[11px] font-bold text-white">
                  {initials}
                </div>
                <span className="text-[13px] font-medium text-[#111111]">{displayName.split(' ')[0]}</span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-12 bg-white border border-[#E5E5E5] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] w-52 py-2 z-50">
                  <div className="px-4 py-3 border-b border-[#F0F0EE]">
                    <p className="text-[13px] font-semibold text-[#111111]">{displayName}</p>
                    <p className="text-[12px] text-[#6B6B6B] truncate">{user.email}</p>
                  </div>
                  {[
                    ['Dashboard', '/dashboard'],
                    ['My listings', '/dashboard'],
                    ['Messages', '/messages'],
                  ].map(([label, href]) => (
                    <Link key={label} href={href} onClick={() => setProfileOpen(false)} className="block px-4 py-2.5 text-[13px] text-[#111111] hover:bg-[#F5F5F3] transition-colors">
                      {label}
                    </Link>
                  ))}
                  <div className="border-t border-[#F0F0EE] mt-1 pt-1">
                    <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-[13px] text-red-500 hover:bg-red-50 transition-colors rounded-b-2xl">
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/auth/login" className="text-[13px] font-medium text-[#6B6B6B] hover:text-[#111111] transition-colors">Sign in</Link>
              <Link href="/sell" className="bg-[#111111] text-white text-[13px] font-semibold px-5 py-2.5 rounded-full hover:bg-[#333] transition-colors">List your car</Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setOpen(!open)} className="md:hidden p-2" aria-label="Menu">
          {open
            ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          }
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden bg-[#FAFAF7] border-t border-[#E5E5E5] px-5 py-5 flex flex-col gap-4">
          {user && (
            <div className="flex items-center gap-3 pb-4 border-b border-[#E5E5E5]">
              <div className="w-9 h-9 bg-[#111111] rounded-full flex items-center justify-center text-[12px] font-bold text-white">{initials}</div>
              <div>
                <p className="text-[14px] font-semibold text-[#111111]">{displayName}</p>
                <p className="text-[12px] text-[#6B6B6B]">{user.email}</p>
              </div>
            </div>
          )}
          {[['Browse', '/browse'], ['Sell', '/sell'], ['How it works', '/#how-it-works']].map(([l, h]) => (
            <Link key={l} href={h} onClick={() => setOpen(false)} className="text-[15px] font-medium text-[#111111]">{l}</Link>
          ))}
          {user ? (
            <>
              <Link href="/dashboard" onClick={() => setOpen(false)} className="text-[15px] font-medium text-[#111111]">Dashboard</Link>
              <Link href="/messages" onClick={() => setOpen(false)} className="text-[15px] font-medium text-[#111111]">Messages</Link>
              <button onClick={() => { setOpen(false); handleLogout() }} className="text-left text-[15px] font-medium text-red-500">Sign out</button>
            </>
          ) : (
            <>
              <Link href="/auth/login" onClick={() => setOpen(false)} className="text-[15px] font-medium text-[#111111]">Sign in</Link>
              <Link href="/auth/signup" onClick={() => setOpen(false)} className="bg-[#111111] text-white text-[14px] font-semibold px-5 py-3 rounded-full text-center">Create account</Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
