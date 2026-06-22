import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/server'
import { formatPrice, formatMileage } from '@/lib/utils'
import { storageImage } from '@/lib/utils'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = createClient()
  const { data: p } = await supabase.from('profiles').select('full_name').eq('id', params.id).maybeSingle()
  const name = p?.full_name || 'Private Seller'
  return { title: `${name} — seller profile`, description: `Cars listed and sold by ${name} on private.` }
}

type Row = {
  id: string; year: number; make: string; model: string; trim: string | null
  price: number; mileage: number; images: string[]; status: string; negotiation_price: number | null
}

function CarCard({ l }: { l: Row }) {
  const negotiating = l.status === 'active' && l.negotiation_price != null
  return (
    <Link href={`/listing/${l.id}`} className="group block">
      <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-[0_1px_6px_rgba(0,0,0,0.05)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.10)] transition-all overflow-hidden">
        <div className="relative bg-[#F5F5F3]" style={{ aspectRatio: '1/1' }}>
          <img src={storageImage(l.images?.[0], { width: 480, quality: 75 }) || 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=480&q=75'} alt={`${l.year} ${l.make} ${l.model}`} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          {l.status === 'sold' && <span className="absolute top-2 left-2 text-[10px] font-bold text-white bg-[#111111] rounded-full px-2 py-0.5">Sold</span>}
          {negotiating && <span className="absolute top-2 left-2 text-[10px] font-bold text-amber-800 bg-amber-100 rounded-full px-2 py-0.5">In negotiation</span>}
        </div>
        <div className="p-2.5">
          <p className="text-[15px] font-bold text-[#111111] leading-tight">{negotiating ? formatPrice(l.negotiation_price as number) : formatPrice(l.price)}</p>
          <p className="text-[13px] text-[#111111] truncate mt-0.5">{l.year} {l.make} {l.model}</p>
          <p className="text-[12px] text-[#6B6B6B] truncate mt-0.5">{formatMileage(l.mileage)}</p>
        </div>
      </div>
    </Link>
  )
}

function Section({ title, rows }: { title: string; rows: Row[] }) {
  if (rows.length === 0) return null
  return (
    <section className="mb-10">
      <h2 className="text-[18px] font-semibold text-[#111111] tracking-tight mb-4">{title} <span className="text-[#6B6B6B] font-normal">· {rows.length}</span></h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {rows.map((l) => <CarCard key={l.id} l={l} />)}
      </div>
    </section>
  )
}

export default async function SellerProfilePage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const [{ data: profile }, { data: listings }] = await Promise.all([
    supabase.from('profiles').select('full_name, created_at').eq('id', params.id).maybeSingle(),
    supabase.from('listings')
      .select('id, year, make, model, trim, price, mileage, images, status, negotiation_price')
      .eq('seller_id', params.id)
      .in('status', ['active', 'sold'])
      .order('created_at', { ascending: false }),
  ])

  const rows = (listings || []) as Row[]
  const inNegotiation = rows.filter((l) => l.status === 'active' && l.negotiation_price != null)
  const active = rows.filter((l) => l.status === 'active' && l.negotiation_price == null)
  const sold = rows.filter((l) => l.status === 'sold')
  const name = profile?.full_name || 'Private Seller'

  return (
    <div className="min-h-screen bg-[#FAFAF7]">
      <Navbar />
      <div className="max-w-7xl mx-auto px-5 py-10">
        <div className="flex items-center gap-4 mb-10">
          <div className="w-16 h-16 bg-[#111111] rounded-full flex items-center justify-center text-[20px] font-bold text-white">
            {name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div>
            <h1 className="text-[26px] font-bold text-[#111111] tracking-tight">{name}</h1>
            <p className="text-[13px] text-[#6B6B6B] flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Identity verified by private. · {active.length + inNegotiation.length} active · {sold.length} sold
            </p>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="text-[14px] text-[#6B6B6B]">This seller has no public listings yet.</p>
        ) : (
          <>
            <Section title="Available" rows={active} />
            <Section title="In negotiation" rows={inNegotiation} />
            <Section title="Sold" rows={sold} />
          </>
        )}
      </div>
    </div>
  )
}
