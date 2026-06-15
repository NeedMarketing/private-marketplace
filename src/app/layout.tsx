import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Providers from '@/context/Providers'
import './globals.css'

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'] })

const SITE_URL = 'https://privatecarz.com'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'private. — Buy & sell private-party cars (no dealerships)',
    template: '%s · private.',
  },
  description: 'private. is a marketplace for private-party vehicles only — no dealerships, no middlemen, no spam listings. Browse verified private sellers and message them directly.',
  keywords: ['private party cars', 'used cars for sale by owner', 'buy car from private seller', 'sell my car', 'no dealership cars', 'private car marketplace'],
  applicationName: 'private.',
  alternates: { canonical: '/' },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  openGraph: {
    type: 'website',
    siteName: 'private.',
    url: SITE_URL,
    title: 'private. — Buy & sell private-party cars (no dealerships)',
    description: 'A marketplace for private-party vehicles only. No dealerships. No middlemen. No spam.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'private. — Buy & sell private-party cars',
    description: 'A marketplace for private-party vehicles only. No dealerships. No middlemen.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
