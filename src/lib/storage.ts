// ─── Types ─────────────────────────────────────────────────────────────────

export type UserType = 'buyer' | 'seller' | 'both'

export type User = {
  id: string
  fullName: string
  email: string
  phone: string
  password: string
  userType: UserType
  createdAt: string
}

export type AppListing = {
  id: string
  sellerId: string
  sellerName: string
  sellerPhone: string
  year: number
  make: string
  model: string
  trim: string
  price: number
  mileage: number
  location: string
  condition: 'Like New' | 'Excellent' | 'Good' | 'Fair'
  titleStatus: string
  color: string
  interiorColor: string
  transmission: string
  fuelType: string
  vin: string
  description: string
  images: string[]
  contactPreference: 'message' | 'phone' | 'both'
  status: 'active' | 'sold'
  createdAt: string
}

export type Thread = {
  id: string
  listingId: string
  listingTitle: string
  listingImage: string
  buyerId: string
  buyerName: string
  sellerId: string
  sellerName: string
  lastMessage: string
  lastMessageAt: string
  createdAt: string
}

export type Message = {
  id: string
  threadId: string
  senderId: string
  senderName: string
  text: string
  createdAt: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const read = <T>(key: string): T[] => {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}

const write = <T>(key: string, data: T[]) => {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(key, JSON.stringify(data)) } catch (e) {
    console.warn('localStorage quota exceeded:', e)
  }
}

const K = {
  users: 'pm_users',
  session: 'pm_session',
  listings: 'pm_listings',
  threads: 'pm_threads',
  messages: 'pm_messages',
  seeded: 'pm_seeded',
}

// ─── Users ──────────────────────────────────────────────────────────────────

export const getUsers = (): User[] => read(K.users)
export const createUser = (u: User) => write(K.users, [...getUsers(), u])
export const findUserByEmail = (e: string) =>
  getUsers().find((u) => u.email.toLowerCase() === e.toLowerCase())
export const getUserById = (id: string) => getUsers().find((u) => u.id === id)
export const updateUser = (u: User) =>
  write(K.users, getUsers().map((x) => (x.id === u.id ? u : x)))

// ─── Session ────────────────────────────────────────────────────────────────

export const getSessionId = (): string | null =>
  typeof window === 'undefined' ? null : localStorage.getItem(K.session)
export const setSessionId = (id: string) => localStorage.setItem(K.session, id)
export const clearSession = () => localStorage.removeItem(K.session)

// ─── Listings ────────────────────────────────────────────────────────────────

export const getListings = (): AppListing[] => read(K.listings)
export const createListing = (l: AppListing) => write(K.listings, [...getListings(), l])
export const updateListing = (l: AppListing) =>
  write(K.listings, getListings().map((x) => (x.id === l.id ? l : x)))
export const deleteListing = (id: string) =>
  write(K.listings, getListings().filter((x) => x.id !== id))
export const getListingById = (id: string) => getListings().find((l) => l.id === id)

// ─── Threads ─────────────────────────────────────────────────────────────────

export const getThreads = (): Thread[] => read(K.threads)
export const createThread = (t: Thread) => write(K.threads, [...getThreads(), t])
export const updateThread = (t: Thread) =>
  write(K.threads, getThreads().map((x) => (x.id === t.id ? t : x)))
export const getThreadById = (id: string) => getThreads().find((t) => t.id === id)

// ─── Messages ────────────────────────────────────────────────────────────────

const getAllMessages = (): Message[] => read(K.messages)
export const getMessagesByThread = (threadId: string): Message[] =>
  getAllMessages().filter((m) => m.threadId === threadId)
export const createMessage = (m: Message) =>
  write(K.messages, [...getAllMessages(), m])

// ─── Seed guard ──────────────────────────────────────────────────────────────

export const isSeeded = (): boolean =>
  typeof window !== 'undefined' && localStorage.getItem(K.seeded) === '1'
export const markSeeded = () => localStorage.setItem(K.seeded, '1')

// ─── Utils ───────────────────────────────────────────────────────────────────

export const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`

export const formatPrice = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

export const formatMileage = (n: number) =>
  new Intl.NumberFormat('en-US').format(n) + ' mi'

export const timeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const compressImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const MAX = 900
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * ratio)
        canvas.height = Math.round(img.height * ratio)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.75))
      }
      img.onerror = reject
      img.src = e.target!.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
