import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/server'
import { formatPrice } from '@/lib/utils'
import type { Listing } from '@/lib/types'
import ListingClient from './ListingClient'

const SITE_URL = 'https://privatecarz.com'
const LISTING_COLUMNS =
  'id, seller_id, year, make, model, trim, price, mileage, location, condition, title_status, color, interior_color, transmission, fuel_type, vin, description, images, contact_preference, status'

async function fetchListing(id: string): Promise<Listing | null> {
  const supabase = createClient()
  const { data } = await supabase.from('listings').select(LISTING_COLUMNS).eq('id', id).maybeSingle()
  if (!data) return null
  const { data: prof } = await supabase.from('profiles').select('full_name, phone').eq('id', data.seller_id).maybeSingle()
  return { ...(data as unknown as Listing), profiles: prof || undefined }
}

// Per-listing <title>, description, and social preview — this is what lets each
// car rank in Google for searches like "2022 BMW X5M for sale".
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = createClient()
  const { data: l } = await supabase
    .from('listings')
    .select('year, make, model, trim, price, location, description, images')
    .eq('id', params.id)
    .maybeSingle()

  if (!l) return { title: 'Listing not found' }

  const name = `${l.year} ${l.make} ${l.model}${l.trim ? ` ${l.trim}` : ''}`
  const title = `${name} for sale${l.location ? ` in ${l.location}` : ''}`
  const description =
    (l.description && l.description.trim().slice(0, 155)) ||
    `${name} listed at ${formatPrice(l.price)}${l.location ? ` in ${l.location}` : ''}. Private-party — no dealership. Message the seller directly on private.`
  const image = Array.isArray(l.images) && l.images[0] ? l.images[0] : undefined

  return {
    title,
    description,
    alternates: { canonical: `/listing/${params.id}` },
    openGraph: { title, description, url: `${SITE_URL}/listing/${params.id}`, type: 'website', images: image ? [image] : undefined },
    twitter: { card: 'summary_large_image', title, description, images: image ? [image] : undefined },
  }
}

export default async function ListingPage({ params }: { params: { id: string } }) {
  const listing = await fetchListing(params.id)

  if (!listing) {
    return (
      <div className="min-h-screen bg-[#FAFAF7]">
        <Navbar />
        <div className="max-w-7xl mx-auto px-5 py-32 text-center">
          <h1 className="text-[28px] font-bold text-[#111111] mb-4">Listing not found.</h1>
          <Link href="/browse" className="bg-[#111111] text-white text-[14px] font-semibold px-7 py-3.5 rounded-full hover:bg-[#333] transition-colors">Back to browse</Link>
        </div>
      </div>
    )
  }

  // Structured data so Google can show rich results for the vehicle.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: `${listing.year} ${listing.make} ${listing.model}`,
    brand: { '@type': 'Brand', name: listing.make },
    model: listing.model,
    vehicleModelDate: String(listing.year),
    ...(listing.vin ? { vehicleIdentificationNumber: listing.vin } : {}),
    ...(listing.fuel_type ? { fuelType: listing.fuel_type } : {}),
    ...(listing.transmission ? { vehicleTransmission: listing.transmission } : {}),
    ...(listing.color ? { color: listing.color } : {}),
    mileageFromOdometer: { '@type': 'QuantitativeValue', value: listing.mileage, unitCode: 'SMI' },
    image: (listing.images || []).slice(0, 5),
    ...(listing.description ? { description: listing.description } : {}),
    offers: {
      '@type': 'Offer',
      price: listing.price,
      priceCurrency: 'USD',
      availability: listing.status === 'sold' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
      ...(listing.location ? { areaServed: listing.location } : {}),
      url: `${SITE_URL}/listing/${listing.id}`,
    },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ListingClient initialListing={listing} />
    </>
  )
}
