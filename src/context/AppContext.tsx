"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import {
  User, AppListing, Thread, Message,
  getUsers, createUser, findUserByEmail, getUserById, updateUser,
  getSessionId, setSessionId, clearSession,
  getListings, createListing, updateListing, deleteListing, getListingById,
  getThreads, createThread, updateThread, getThreadById,
  getMessagesByThread, createMessage,
  isSeeded, markSeeded, uid,
} from '@/lib/storage'

// ─── Seed data ───────────────────────────────────────────────────────────────

const SEED: AppListing[] = [
  { id: '1', sellerId: '', sellerName: 'Demo Seller', sellerPhone: '', year: 2021, make: 'BMW', model: 'M340i', trim: 'xDrive', price: 42500, mileage: 38200, location: 'Tampa, FL', condition: 'Excellent', titleStatus: 'Clean title', color: 'Mineral White', interiorColor: 'Black', transmission: 'Automatic', fuelType: 'Gas', vin: 'WBA5U7C04M9E12345', description: 'One owner, always garage kept. Factory warranty still active. Sport package, heads-up display, Harman Kardon sound. Never tracked.', images: ['https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800'], contactPreference: 'message', status: 'active', createdAt: new Date(Date.now() - 7 * 864e5).toISOString() },
  { id: '2', sellerId: '', sellerName: 'Demo Seller', sellerPhone: '', year: 2020, make: 'Mercedes-Benz', model: 'C300', trim: '4MATIC', price: 28900, mileage: 52100, location: 'Miami, FL', condition: 'Good', titleStatus: 'Clean title', color: 'Obsidian Black', interiorColor: 'Beige', transmission: 'Automatic', fuelType: 'Gas', vin: '55SWF4JB4LU123456', description: 'Clean Carfax. No accidents. Burmester sound, panoramic roof, AMG styling. Tires replaced at 48k miles.', images: ['https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800'], contactPreference: 'message', status: 'active', createdAt: new Date(Date.now() - 5 * 864e5).toISOString() },
  { id: '3', sellerId: '', sellerName: 'Demo Seller', sellerPhone: '', year: 2019, make: 'Porsche', model: '911 Carrera', trim: 'Base', price: 89000, mileage: 24800, location: 'Fort Lauderdale, FL', condition: 'Excellent', titleStatus: 'Clean title', color: 'Guards Red', interiorColor: 'Black', transmission: 'Automatic', fuelType: 'Gas', vin: 'WP0AA2A92KS123456', description: 'Full Porsche service history. Sport Chrono package, PASM sport suspension, 20-inch Carrera S wheels. No modifications.', images: ['https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800'], contactPreference: 'message', status: 'active', createdAt: new Date(Date.now() - 3 * 864e5).toISOString() },
  { id: '4', sellerId: '', sellerName: 'Demo Seller', sellerPhone: '', year: 2022, make: 'Toyota', model: 'Camry', trim: 'XSE', price: 29500, mileage: 19300, location: 'Orlando, FL', condition: 'Like New', titleStatus: 'Clean title', color: 'Midnight Black', interiorColor: 'Red', transmission: 'Automatic', fuelType: 'Gas', vin: '4T1G11AK6NU123456', description: 'Barely driven. Two-car household. Toyota Care maintenance done. All original window stickers included.', images: ['https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800'], contactPreference: 'message', status: 'active', createdAt: new Date(Date.now() - 2 * 864e5).toISOString() },
  { id: '5', sellerId: '', sellerName: 'Demo Seller', sellerPhone: '', year: 2021, make: 'Dodge', model: 'Charger', trim: 'Scat Pack', price: 43000, mileage: 31000, location: 'Atlanta, GA', condition: 'Good', titleStatus: 'Clean title', color: 'F8 Green', interiorColor: 'Black', transmission: 'Automatic', fuelType: 'Gas', vin: '2C3CDXGJ9MH123456', description: '485hp with Widebody package. Performance Pages, adaptive damping. Clean title.', images: ['https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800'], contactPreference: 'message', status: 'active', createdAt: new Date(Date.now() - 864e5).toISOString() },
  { id: '6', sellerId: '', sellerName: 'Demo Seller', sellerPhone: '', year: 2020, make: 'Chevrolet', model: 'Corvette', trim: 'Stingray', price: 67500, mileage: 18900, location: 'Dallas, TX', condition: 'Excellent', titleStatus: 'Clean title', color: 'Rapid Blue', interiorColor: 'Jet Black', transmission: 'Automatic', fuelType: 'Gas', vin: '1G1YB2D41L5123456', description: 'Mid-engine C8. Z51 package, magnetic ride, front lift. Weekend driver. Climate-controlled storage.', images: ['https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800'], contactPreference: 'message', status: 'active', createdAt: new Date(Date.now() - 43200000).toISOString() },
]

// ─── Context type ─────────────────────────────────────────────────────────────

type Ctx = {
  user: User | null
  listings: AppListing[]
  threads: Thread[]
  loading: boolean
  login: (email: string, pw: string) => Promise<{ ok: boolean; error?: string }>
  signup: (data: Omit<User, 'id' | 'createdAt'>) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  saveProfile: (u: User) => void
  addListing: (data: Omit<AppListing, 'id' | 'createdAt' | 'sellerId' | 'sellerName' | 'sellerPhone'>) => string
  editListing: (l: AppListing) => void
  removeListing: (id: string) => void
  markSold: (id: string) => void
  openThread: (listingId: string) => string
  sendMessage: (threadId: string, text: string) => void
  getThreadMessages: (threadId: string) => Message[]
}

const AppCtx = createContext<Ctx | null>(null)
export const useApp = () => {
  const c = useContext(AppCtx)
  if (!c) throw new Error('useApp must be inside AppProvider')
  return c
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [listings, setListings] = useState<AppListing[]>([])
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSeeded()) {
      SEED.forEach(createListing)
      markSeeded()
    }
    const id = getSessionId()
    if (id) {
      const u = getUserById(id)
      if (u) setUser(u)
    }
    setListings(getListings())
    setThreads(getThreads())
    setLoading(false)
  }, [])

  // ── Auth ──────────────────────────────────────────────────────────────────

  const login = async (email: string, pw: string) => {
    const u = findUserByEmail(email)
    if (!u) return { ok: false, error: 'No account found with that email.' }
    if (u.password !== pw) return { ok: false, error: 'Incorrect password.' }
    setUser(u)
    setSessionId(u.id)
    return { ok: true }
  }

  const signup = async (data: Omit<User, 'id' | 'createdAt'>) => {
    if (findUserByEmail(data.email)) return { ok: false, error: 'An account with that email already exists.' }
    const u: User = { ...data, id: `user_${uid()}`, createdAt: new Date().toISOString() }
    createUser(u)
    setUser(u)
    setSessionId(u.id)
    return { ok: true }
  }

  const logout = () => { clearSession(); setUser(null) }

  const saveProfile = (u: User) => { updateUser(u); setUser(u) }

  // ── Listings ──────────────────────────────────────────────────────────────

  const addListing = (data: Omit<AppListing, 'id' | 'createdAt' | 'sellerId' | 'sellerName' | 'sellerPhone'>): string => {
    if (!user) throw new Error('Not authenticated')
    const l: AppListing = { ...data, id: `listing_${uid()}`, sellerId: user.id, sellerName: user.fullName, sellerPhone: user.phone, createdAt: new Date().toISOString() }
    createListing(l)
    setListings(getListings())
    return l.id
  }

  const editListing = (l: AppListing) => { updateListing(l); setListings(getListings()) }

  const removeListing = (id: string) => { deleteListing(id); setListings(getListings()) }

  const markSold = (id: string) => {
    const l = getListingById(id)
    if (l) { updateListing({ ...l, status: 'sold' }); setListings(getListings()) }
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  const openThread = (listingId: string): string => {
    if (!user) throw new Error('Not authenticated')
    const listing = getListingById(listingId)
    if (!listing) throw new Error('Listing not found')
    const threadId = `thread_${listingId}_${user.id}`
    if (getThreadById(threadId)) return threadId
    const now = new Date().toISOString()
    const firstText = `Hey, I'm interested in your ${listing.year} ${listing.make} ${listing.model}. Is it still available?`
    const t: Thread = { id: threadId, listingId, listingTitle: `${listing.year} ${listing.make} ${listing.model}`, listingImage: listing.images[0] || '', buyerId: user.id, buyerName: user.fullName, sellerId: listing.sellerId, sellerName: listing.sellerName, lastMessage: firstText, lastMessageAt: now, createdAt: now }
    createThread(t)
    createMessage({ id: `msg_${uid()}`, threadId, senderId: user.id, senderName: user.fullName, text: firstText, createdAt: now })
    updateThread({ ...t, lastMessage: firstText, lastMessageAt: now })
    setThreads(getThreads())
    return threadId
  }

  const sendMessage = (threadId: string, text: string) => {
    if (!user || !text.trim()) return
    const now = new Date().toISOString()
    createMessage({ id: `msg_${uid()}`, threadId, senderId: user.id, senderName: user.fullName, text: text.trim(), createdAt: now })
    const t = getThreadById(threadId)
    if (t) { updateThread({ ...t, lastMessage: text.trim(), lastMessageAt: now }); setThreads(getThreads()) }
  }

  const getThreadMessages = (threadId: string): Message[] => getMessagesByThread(threadId)

  return (
    <AppCtx.Provider value={{ user, listings, threads, loading, login, signup, logout, saveProfile, addListing, editListing, removeListing, markSold, openThread, sendMessage, getThreadMessages }}>
      {children}
    </AppCtx.Provider>
  )
}
