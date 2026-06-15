"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

const inp = "w-full border border-[#E5E5E5] rounded-xl px-4 py-3 text-[14px] text-[#111111] placeholder:text-[#6B6B6B] outline-none focus:border-[#111111] transition-colors bg-white"

export default function SignupPage() {
  const { signup } = useAuth()
  const router = useRouter()

  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.fullName.trim()) return setError('Full name is required.')
    if (!form.email.includes('@')) return setError('Enter a valid email.')
    if (form.phone.replace(/\D/g, '').length < 10) return setError('Enter a valid phone number.')
    if (form.password.length < 6) return setError('Password must be at least 6 characters.')
    setLoading(true)
    const { ok, error: err } = await signup({
      fullName: form.fullName.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      password: form.password,
    })
    setLoading(false)
    if (!ok) return setError(err || 'Something went wrong.')
    // If email confirmation is enabled, show check-email screen; otherwise go to dashboard
    setCheckEmail(true)
    setTimeout(() => router.push('/dashboard'), 1500)
  }

  if (checkEmail) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex flex-col items-center justify-center px-5">
        <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <h1 className="text-[24px] font-bold text-[#111111] mb-2">Account created!</h1>
        <p className="text-[15px] text-[#6B6B6B] text-center max-w-xs">
          Check your email to confirm your account, then you&apos;ll be redirected to your dashboard.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
      <div className="px-6 py-5 flex items-center justify-between border-b border-[#E5E5E5]">
        <Link href="/" className="text-xl font-bold text-[#111111]">private.</Link>
        <Link href="/auth/login" className="text-[13px] font-medium text-[#6B6B6B] hover:text-[#111111] transition-colors">Already have an account? <span className="text-[#111111] underline">Sign in</span></Link>
      </div>

      <div className="flex-1 flex items-start justify-center px-5 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-[30px] font-bold text-[#111111] tracking-tight mb-2">Create your account</h1>
            <p className="text-[15px] text-[#6B6B6B]">Join private. and buy or sell your car directly.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#111111] mb-1.5">Full name</label>
              <input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="Jane Smith" className={inp} autoComplete="name" />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111111] mb-1.5">Email</label>
              <input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="jane@email.com" type="email" className={inp} autoComplete="email" />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111111] mb-1.5">Phone number</label>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(555) 000-0000" type="tel" className={inp} autoComplete="tel" />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111111] mb-1.5">Password</label>
              <div className="relative">
                <input value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="At least 6 characters" type={showPw ? 'text' : 'password'} className={inp + ' pr-12'} autoComplete="new-password" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B6B6B] hover:text-[#111111] transition-colors text-[12px] font-medium">
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-[13px] text-red-600">{error}</div>
            )}

            <button type="submit" disabled={loading} className="w-full bg-[#111111] text-white text-[14px] font-semibold py-4 rounded-xl hover:bg-[#333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-1">
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="text-[12px] text-[#6B6B6B] text-center mt-5 leading-relaxed">
            By creating an account you agree to our{' '}
            <span className="underline cursor-pointer">Terms of Service</span> and{' '}
            <span className="underline cursor-pointer">Privacy Policy</span>.
          </p>
        </div>
      </div>
    </div>
  )
}
