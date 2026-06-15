import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Providers from '@/context/Providers'
import './globals.css'

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'] })

export const metadata: Metadata = {
  title: 'private. — Private-party cars only.',
  description: 'A marketplace for private-party vehicles only. No dealerships. No middlemen. No spam.',
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
