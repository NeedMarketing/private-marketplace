import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

const SITE_URL = 'https://privatecarz.com'

export const revalidate = 3600 // refresh the sitemap hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/browse`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/sell`, changeFrequency: 'monthly', priority: 0.5 },
  ]

  // Include every active listing so Google can index individual cars.
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from('listings')
      .select('id, updated_at, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(5000)

    const listingRoutes: MetadataRoute.Sitemap = (data || []).map((l) => ({
      url: `${SITE_URL}/listing/${l.id}`,
      lastModified: l.updated_at || l.created_at || undefined,
      changeFrequency: 'weekly',
      priority: 0.8,
    }))
    return [...staticRoutes, ...listingRoutes]
  } catch {
    return staticRoutes
  }
}
