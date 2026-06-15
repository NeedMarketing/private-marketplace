import type { MetadataRoute } from 'next'

const SITE_URL = 'https://privatecarz.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Don't index private/auth-gated areas — they're not useful search results.
      disallow: ['/dashboard', '/messages', '/sell', '/auth/', '/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
