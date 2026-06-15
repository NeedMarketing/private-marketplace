import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Browse private-party cars for sale',
  description: 'Browse cars for sale by private owners — no dealerships. Filter by make, price, and year, and message verified sellers directly on private.',
  alternates: { canonical: '/browse' },
}

export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  return children
}
