export function formatPrice(n: number): string {
  return '$' + n.toLocaleString('en-US')
}

export function formatMileage(n: number): string {
  return n.toLocaleString('en-US') + ' mi'
}

// Returns an optimized image URL.
// - Supabase Storage URLs are served AS-IS (the original public file). We do NOT
//   use Supabase's /render/image transform endpoint — the Pro plan only includes
//   100 image transformations/month and it blows the quota fast. Uploads are
//   already cropped to a reasonable size by the sell/edit cropper, and bandwidth
//   is well within plan limits, so serving originals is the cheaper choice.
// - Unsplash URLs get free CDN width/quality query params.
// - Anything else is returned unchanged.
export function storageImage(url: string | undefined, opts: { width: number; quality?: number }): string {
  if (!url) return ''
  const { width, quality = 75 } = opts

  if (url.includes('images.unsplash.com')) {
    const base = url.split('?')[0]
    return `${base}?w=${width}&q=${quality}`
  }

  // Supabase storage (and everything else): serve the original, no transformation.
  return url
}

export function timeAgo(iso: string | undefined): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
