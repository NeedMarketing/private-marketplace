"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

const inp = "w-full border border-[#E5E5E5] rounded-xl px-4 py-3 text-[14px] text-[#111111] placeholder:text-[#6B6B6B] outline-none focus:border-[#111111] transition-colors bg-white"

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) return setError('Enter your email and password.')
    setLoading(true)
    const { ok, error: err } = await login(email.trim().toLowerCase(), password)
    setLoading(false)
    if (!ok) return setError(err || 'Invalid email or password.')
    const params = new URLSearchParams(window.location.search)
    router.push(params.get('next') || '/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col">
      <div className="px-6 py-5 flex items-center justify-between border-b border-[#E5E5E5]">
        <Link href="/" className="text-xl font-bold text-[#111111]">private.</Link>
        <Link href="/auth/signup" className="text-[13px] font-medium text-[#6B6B6B] hover:text-[#111111] transition-colors">No account? <span className="text-[#111111] underline">Sign up</span></Link>
      </div>

      <div className="flex-1 flex items-start justify-center px-5 py-14">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-[30px] font-bold text-[#111111] tracking-tight mb-2">Welcome back.</h1>
            <p className="text-[15px] text-[#6B6B6B]">Sign in to your private. account.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#111111] mb-1.5">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@email.com" type="email" className={inp} autoComplete="email" autoFocus />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-[#111111] mb-1.5">Password</label>
              <div className="relative">
                <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" type={showPw ? 'text' : 'password'} className={inp + ' pr-12'} autoComplete="current-password" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-medium text-[#6B6B6B] hover:text-[#111111] transition-colors">
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-[13px] text-red-600">{error}</div>
            )}

            <button type="submit" disabled={loading} className="w-full bg-[#111111] text-white text-[14px] font-semibold py-4 rounded-xl hover:bg-[#333] transition-colors disabled:opacity-50 mt-1">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[13px] text-[#6B6B6B]">
              Don&apos;t have an account?{' '}
              <Link href="/auth/signup" className="text-[#111111] font-semibold hover:underline">Create one →</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
