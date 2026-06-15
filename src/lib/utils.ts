export function formatPrice(n: number): string {
  return '$' + n.toLocaleString('en-US')
}

export function formatMileage(n: number): string {
  return n.toLocaleString('en-US') + ' mi'
}

// Returns a resized/optimized version of an image URL.
// - Supabase Storage URLs are routed through the image-transformation endpoint
//   (/render/image/public/) with width + quality params so we never download the
//   full original file for a thumbnail or card.
// - Unsplash URLs get width/quality query params.
// - Anything else is returned unchanged.
export function storageImage(url: string | undefined, opts: { width: number; quality?: number }): string {
  if (!url) return ''
  const { width, quality = 75 } = opts

  if (url.includes('/storage/v1/object/public/')) {
    const transformed = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
    const sep = transformed.includes('?') ? '&' : '?'
    return `${transformed}${sep}width=${width}&quality=${quality}&resize=cover`
  }

  if (url.includes('images.unsplash.com')) {
    const base = url.split('?')[0]
    return `${base}?w=${width}&q=${quality}`
  }

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
