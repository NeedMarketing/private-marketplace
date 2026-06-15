"use client"

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import ImageCropper from '@/components/ImageCropper'
import { useAuth } from '@/context/AuthContext'
import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/utils'

const inp = "w-full border border-[#E5E5E5] rounded-xl px-4 py-3 text-[14px] text-[#111111] placeholder:text-[#6B6B6B] outline-none focus:border-[#111111] transition-colors bg-white"
const sel = inp + " appearance-none cursor-pointer pr-10"

type FormState = {
  year: number
  make: string
  model: string
  trim: string
  mileage: number
  vin: string
  price: number
  location: string
  condition: 'Like New' | 'Excellent' | 'Good' | 'Fair'
  title_status: string
  color: string
  interior_color: string
  transmission: string
  fuel_type: string
  description: string
  contact_preference: 'message' | 'phone' | 'both'
}

const EMPTY: FormState = {
  year: new Date().getFullYear(),
  make: '', model: '', trim: '', mileage: 0, vin: '',
  price: 0, location: '', condition: 'Good', title_status: 'Clean title',
  color: '', interior_color: '', transmission: 'Automatic', fuel_type: 'Gas',
  description: '', contact_preference: 'message',
}

const STEPS = ['Vehicle', 'Condition', 'Photos', 'Pricing', 'Contact', 'Publish']

const MAKES = ['Acura','Alfa Romeo','Aston Martin','Audi','Bentley','BMW','Bugatti','Buick','Cadillac','Chevrolet','Chrysler','Dodge','Ferrari','Fiat','Ford','GMC','Honda','Hyundai','Infiniti','Jaguar','Jeep','Kia','Lamborghini','Land Rover','Lexus','Lincoln','Lotus','Maserati','Mazda','McLaren','Mercedes-Benz','MINI','Mitsubishi','Nissan','Porsche','Ram','Rolls-Royce','Subaru','Tesla','Toyota','Volkswagen','Volvo','Other']
const COLORS = ['Black','White','Silver','Gray','Red','Blue','Green','Brown','Yellow','Orange','Purple','Gold','Beige','Other']
const TRANSMISSIONS = ['Automatic','Manual','CVT','Semi-Automatic']
const FUELS = ['Gas','Diesel','Hybrid','Plug-in Hybrid','Electric','Other']
const TITLES = ['Clean title','Rebuilt/Salvage','Lien on title','No title','Missing']

export default function SellPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [imageFiles, setImageFiles] = useState<{ preview: string; file: File }[]>([])
  const [cropQueue, setCropQueue] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [publishedId, setPublishedId] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login?next=/sell')
  }, [user, loading, router])

  const set = (k: keyof FormState, v: unknown) => setForm((f) => ({ ...f, [k]: v }))

  const addImages = (files: FileList) => {
    // Queue selected images for cropping (max 8 total across existing + queued).
    const room = 8 - imageFiles.length - cropQueue.length
    if (room <= 0) return
    const added = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, room)
    setCropQueue((prev) => [...prev, ...added])
  }

  // Cropper produced a framed 4:3 image — store it and move to the next in the queue.
  const handleCropDone = (cropped: File) => {
    setImageFiles((prev) => [...prev, { preview: URL.createObjectURL(cropped), file: cropped }])
    setCropQueue((prev) => prev.slice(1))
  }
  const handleCropSkip = () => setCropQueue((prev) => prev.slice(1))

  const removeImage = (i: number) => {
    URL.revokeObjectURL(imageFiles[i].preview)
    setImageFiles((prev) => prev.filter((_, idx) => idx !== i))
  }

  const uploadImages = async (): Promise<string[]> => {
    if (!user) return []
    const supabase = createClient()
    // Upload all images in parallel
    const results = await Promise.all(
      imageFiles.map(async ({ file }) => {
        const ext = file.name.split('.').pop()
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { data, error } = await supabase.storage
          .from('listing-images')
          .upload(path, file, { cacheControl: '3600', upsert: false })
        if (error) throw new Error(`Image upload failed: ${error.message}`)
        const { data: { publicUrl } } = supabase.storage.from('listing-images').getPublicUrl(data.path)
        return publicUrl
      })
    )
    return results.filter((url): url is string => url !== null)
  }

  const publish = async () => {
    if (!user) return
    setSubmitting(true)
    setError('')
    try {
      const imageUrls = await uploadImages()
      const supabase = createClient()
      const { data, error } = await supabase
        .from('listings')
        .insert({
          seller_id: user.id,
          year: form.year,
          make: form.make,
          model: form.model,
          trim: form.trim,
          mileage: form.mileage,
          vin: form.vin,
          price: form.price,
          location: form.location,
          condition: form.condition,
          title_status: form.title_status,
          color: form.color,
          interior_color: form.interior_color,
          transmission: form.transmission,
          fuel_type: form.fuel_type,
          description: form.description,
          contact_preference: form.contact_preference,
          images: imageUrls,
          status: 'active',
        })
        .select('id')
        .single()
      if (error) {
        // Log the full error object (message, details, hint, code) for debugging
        console.error('Listing insert failed:', error)
        const friendly = error.code === '23503'
          ? 'Your seller profile could not be found. Please log out and back in, then try again.'
          : error.message || 'Something went wrong while publishing. Please try again.'
        setError(friendly)
        setSubmitting(false)
        return
      }
      if (!data) {
        setError('The listing was not created. Please try again.')
        setSubmitting(false)
        return
      }
      setPublishedId(data.id)
    } catch (e) {
      console.error('Publish failed:', e)
      setError(e instanceof Error ? e.message : 'Something went wrong while publishing. Please try again.')
      setSubmitting(false)
    }
  }

  const canNext = () => {
    if (step === 0) return form.make && form.model && form.year > 1900
    if (step === 3) return form.price > 0 && form.location.trim()
    return true
  }

  if (loading || !user) return <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#111111] border-t-transparent rounded-full animate-spin" /></div>

  if (publishedId) {
    return (
      <div className="min-h-screen bg-[#FAFAF7]">
        <Navbar />
        <div className="max-w-md mx-auto px-5 py-24 text-center">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <h1 className="text-[28px] font-bold text-[#111111] tracking-tight mb-3">Your listing is live!</h1>
          <p className="text-[15px] text-[#6B6B6B] mb-8">Your {form.year} {form.make} {form.model} is now visible to buyers.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href={`/listing/${publishedId}`} className="bg-[#111111] text-white text-[14px] font-semibold px-6 py-3.5 rounded-full hover:bg-[#333] transition-colors">View listing</Link>
            <Link href="/dashboard" className="border border-[#E5E5E5] text-[#111111] text-[14px] font-semibold px-6 py-3.5 rounded-full hover:border-[#111111] transition-colors">Go to dashboard</Link>
          </div>
        </div>
      </div>
    )
  }

  const sellerName = profile?.full_name || 'You'

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <Navbar />

      {/* Crop each newly-added photo to 4:3 so it displays perfectly everywhere */}
      {cropQueue.length > 0 && (
        <ImageCropper
          key={cropQueue.length}
          file={cropQueue[0]}
          index={imageFiles.length}
          total={imageFiles.length + cropQueue.length}
          aspect={4 / 3}
          onDone={handleCropDone}
          onCancel={handleCropSkip}
        />
      )}

      <div className="max-w-2xl mx-auto px-5 py-10">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-[20px] font-bold text-[#111111] tracking-tight">List your car</h1>
            <span className="text-[13px] font-medium text-[#6B6B6B]">{step + 1} of {STEPS.length}</span>
          </div>
          <div className="w-full bg-[#E5E5E5] rounded-full h-1.5">
            <div className="bg-[#111111] h-1.5 rounded-full transition-all duration-500" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
          <div className="flex justify-between mt-2">
            {STEPS.map((s, i) => (
              <span key={s} className={`text-[11px] font-medium transition-colors ${i === step ? 'text-[#111111]' : i < step ? 'text-[#6B6B6B]' : 'text-[#D0D0D0]'}`}>{s}</span>
            ))}
          </div>
        </div>

        {/* Step 0: Vehicle info */}
        {step === 0 && (
          <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex flex-col gap-5">
            <h2 className="text-[17px] font-semibold text-[#111111]">Vehicle details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-semibold text-[#111111] mb-1.5">Year <span className="text-red-500">*</span></label>
                <input value={form.year} onChange={(e) => set('year', Number(e.target.value))} type="number" min="1900" max="2026" className={inp} />
              </div>
              <div className="relative">
                <label className="block text-[12px] font-semibold text-[#111111] mb-1.5">Make <span className="text-red-500">*</span></label>
                <select value={form.make} onChange={(e) => set('make', e.target.value)} className={sel}>
                  <option value="">Select make</option>
                  {MAKES.map((m) => <option key={m}>{m}</option>)}
                </select>
                <svg className="absolute right-3 bottom-3.5 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#111111] mb-1.5">Model <span className="text-red-500">*</span></label>
              <input value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="e.g. Camry, F-150, Model 3" className={inp} />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#111111] mb-1.5">Trim / Package</label>
              <input value={form.trim} onChange={(e) => set('trim', e.target.value)} placeholder="e.g. SE, Limited, Sport" className={inp} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-semibold text-[#111111] mb-1.5">Mileage</label>
                <input value={form.mileage || ''} onChange={(e) => set('mileage', Number(e.target.value))} type="number" min="0" placeholder="e.g. 45000" className={inp} />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#111111] mb-1.5">VIN <span className="text-[11px] font-normal text-[#6B6B6B]">(optional)</span></label>
                <input value={form.vin} onChange={(e) => set('vin', e.target.value.toUpperCase())} placeholder="17-character VIN" maxLength={17} className={inp + ' font-mono text-[13px]'} />
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Condition & specs */}
        {step === 1 && (
          <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex flex-col gap-5">
            <h2 className="text-[17px] font-semibold text-[#111111]">Condition & specs</h2>
            <div>
              <label className="block text-[12px] font-semibold text-[#111111] mb-2">Condition</label>
              <div className="grid grid-cols-4 gap-2">
                {(['Like New', 'Excellent', 'Good', 'Fair'] as FormState['condition'][]).map((c) => (
                  <button key={c} type="button" onClick={() => set('condition', c)} className={`py-3 text-[12px] font-medium rounded-xl border transition-all text-center ${form.condition === c ? 'bg-[#111111] text-white border-[#111111]' : 'bg-white text-[#111111] border-[#E5E5E5] hover:border-[#111111]'}`}>{c}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-[12px] font-semibold text-[#111111] mb-1.5">Transmission</label>
                <select value={form.transmission} onChange={(e) => set('transmission', e.target.value)} className={sel}>
                  {TRANSMISSIONS.map((t) => <option key={t}>{t}</option>)}
                </select>
                <svg className="absolute right-3 bottom-3.5 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              <div className="relative">
                <label className="block text-[12px] font-semibold text-[#111111] mb-1.5">Fuel type</label>
                <select value={form.fuel_type} onChange={(e) => set('fuel_type', e.target.value)} className={sel}>
                  {FUELS.map((f) => <option key={f}>{f}</option>)}
                </select>
                <svg className="absolute right-3 bottom-3.5 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-[12px] font-semibold text-[#111111] mb-1.5">Exterior color</label>
                <select value={form.color} onChange={(e) => set('color', e.target.value)} className={sel}>
                  <option value="">Select color</option>
                  {COLORS.map((c) => <option key={c}>{c}</option>)}
                </select>
                <svg className="absolute right-3 bottom-3.5 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              <div className="relative">
                <label className="block text-[12px] font-semibold text-[#111111] mb-1.5">Interior color</label>
                <select value={form.interior_color} onChange={(e) => set('interior_color', e.target.value)} className={sel}>
                  <option value="">Select color</option>
                  {COLORS.map((c) => <option key={c}>{c}</option>)}
                </select>
                <svg className="absolute right-3 bottom-3.5 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>
            <div className="relative">
              <label className="block text-[12px] font-semibold text-[#111111] mb-1.5">Title status</label>
              <select value={form.title_status} onChange={(e) => set('title_status', e.target.value)} className={sel}>
                {TITLES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <svg className="absolute right-3 bottom-3.5 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
        )}

        {/* Step 2: Photos */}
        {step === 2 && (
          <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex flex-col gap-5">
            <div>
              <h2 className="text-[17px] font-semibold text-[#111111] mb-1">Photos</h2>
              <p className="text-[13px] text-[#6B6B6B]">Add up to 8 photos. Include exterior, interior, and any damage.</p>
            </div>
            {imageFiles.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {imageFiles.map((img, i) => (
                  <div key={i} className="relative group aspect-square rounded-xl overflow-hidden bg-[#F5F5F3]">
                    <img src={img.preview} alt="" className="w-full h-full object-cover" />
                    {i === 0 && <span className="absolute bottom-1 left-1 text-[9px] font-bold text-white bg-black/60 rounded-md px-1.5 py-0.5">Main</span>}
                    <button onClick={() => removeImage(i)} className="absolute top-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}
                {imageFiles.length < 8 && (
                  <button onClick={() => fileRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-[#E5E5E5] flex items-center justify-center hover:border-[#111111] transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                )}
              </div>
            )}
            {imageFiles.length === 0 && (
              <button onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-[#E5E5E5] rounded-2xl p-10 text-center hover:border-[#111111] transition-colors">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <p className="text-[14px] font-semibold text-[#111111] mb-1">Add photos</p>
                <p className="text-[13px] text-[#6B6B6B]">JPG, PNG up to 10MB each · Max 8 photos</p>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && addImages(e.target.files)} />
            <p className="text-[12px] text-[#6B6B6B]">Photos are uploaded securely when you publish your listing.</p>
          </div>
        )}

        {/* Step 3: Pricing */}
        {step === 3 && (
          <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex flex-col gap-5">
            <h2 className="text-[17px] font-semibold text-[#111111]">Pricing & location</h2>
            <div>
              <label className="block text-[12px] font-semibold text-[#111111] mb-1.5">Asking price <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[14px] font-medium text-[#6B6B6B]">$</span>
                <input value={form.price || ''} onChange={(e) => set('price', Number(e.target.value))} type="number" min="0" placeholder="0" className={inp + ' pl-8'} />
              </div>
              {form.price > 0 && <p className="text-[12px] text-[#6B6B6B] mt-1.5">Listed as {formatPrice(form.price)}</p>}
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#111111] mb-1.5">Location <span className="text-red-500">*</span></label>
              <input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Los Angeles, CA" className={inp} />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#111111] mb-1.5">Seller description</label>
              <textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Share what makes this car special — any recent maintenance, upgrades, or history worth highlighting." rows={5} className={inp + ' resize-none leading-relaxed'} />
              <p className="text-[11px] text-[#6B6B6B] mt-1.5">{form.description.length}/1000 characters</p>
            </div>
          </div>
        )}

        {/* Step 4: Contact preferences */}
        {step === 4 && (
          <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex flex-col gap-5">
            <h2 className="text-[17px] font-semibold text-[#111111]">Contact preferences</h2>
            <p className="text-[13px] text-[#6B6B6B]">How would you like buyers to reach you?</p>
            <div className="flex flex-col gap-2">
              {([['message', 'In-app messages only', 'Buyers contact you through private. messaging (recommended)'], ['phone', 'Phone calls only', 'Share your phone number with interested buyers'], ['both', 'Both message & phone', 'Buyers can message you or call directly']] as ['message' | 'phone' | 'both', string, string][]).map(([val, label, desc]) => (
                <button key={val} type="button" onClick={() => set('contact_preference', val)} className={`text-left p-4 rounded-xl border transition-all ${form.contact_preference === val ? 'border-[#111111] bg-[#F5F5F3]' : 'border-[#E5E5E5] hover:border-[#111111]'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${form.contact_preference === val ? 'border-[#111111] bg-[#111111]' : 'border-[#E5E5E5]'}`}>
                      {form.contact_preference === val && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-[#111111]">{label}</p>
                      <p className="text-[12px] text-[#6B6B6B]">{desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Preview & publish */}
        {step === 5 && (
          <div className="flex flex-col gap-4">
            <div className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
              {imageFiles.length > 0 ? (
                <div className="relative" style={{ aspectRatio: '16/9' }}>
                  <img src={imageFiles[0].preview} alt="" className="w-full h-full object-cover" />
                  {imageFiles.length > 1 && (
                    <span className="absolute bottom-3 right-3 bg-black/60 text-white text-[12px] font-medium px-2.5 py-1 rounded-full">{imageFiles.length} photos</span>
                  )}
                </div>
              ) : (
                <div className="bg-[#F5F5F3] flex items-center justify-center text-[#6B6B6B] text-[13px]" style={{ aspectRatio: '16/9' }}>No photos added</div>
              )}
              <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-[18px] font-bold text-[#111111]">{form.year} {form.make} {form.model}</h3>
                  <span className="text-[22px] font-bold text-[#111111] whitespace-nowrap">{formatPrice(form.price)}</span>
                </div>
                <p className="text-[13px] text-[#6B6B6B] mb-3">{form.trim}</p>
                <div className="grid grid-cols-3 gap-3 text-[12px] text-[#6B6B6B]">
                  <div><p className="font-semibold text-[#111111] text-[13px]">{form.mileage.toLocaleString()} mi</p><p>Mileage</p></div>
                  <div><p className="font-semibold text-[#111111] text-[13px]">{form.condition}</p><p>Condition</p></div>
                  <div><p className="font-semibold text-[#111111] text-[13px]">{form.transmission}</p><p>Trans.</p></div>
                </div>
                <div className="mt-4 pt-4 border-t border-[#F0F0EE] flex items-center gap-2">
                  <div className="w-7 h-7 bg-[#111111] rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                    {sellerName.split(' ').filter(Boolean).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-[#111111]">{sellerName}</p>
                    <p className="text-[11px] text-[#6B6B6B]">{form.location}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-[13px] text-amber-800">
              <p className="font-semibold mb-1">Before you publish</p>
              <ul className="space-y-0.5 text-[12px] text-amber-700">
                <li>· Only list vehicles you legally own</li>
                <li>· Photos and description must accurately represent the car</li>
                <li>· Your contact info is kept private until you choose to share it</li>
              </ul>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <div>
                  <p className="text-[13px] font-semibold text-red-700">Couldn&apos;t publish your listing</p>
                  <p className="text-[12px] text-red-600 mt-0.5">{error}</p>
                </div>
              </div>
            )}

            <button
              onClick={publish}
              disabled={submitting}
              className="w-full bg-[#111111] text-white text-[15px] font-semibold py-4 rounded-2xl hover:bg-[#333] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Publishing…</>
              ) : 'Publish listing'}
            </button>
          </div>
        )}

        {/* Navigation */}
        {!publishedId && (
          <div className={`flex mt-6 ${step === 0 ? 'justify-end' : 'justify-between'}`}>
            {step > 0 && (
              <button onClick={() => setStep((s) => s - 1)} className="flex items-center gap-2 text-[14px] font-medium text-[#6B6B6B] hover:text-[#111111] transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                Back
              </button>
            )}
            {step < STEPS.length - 1 && (
              <button onClick={() => setStep((s) => s + 1)} disabled={!canNext()} className="flex items-center gap-2 bg-[#111111] text-white text-[14px] font-semibold px-6 py-3 rounded-full hover:bg-[#333] transition-colors disabled:opacity-40">
                Continue
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
