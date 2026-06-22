export type Profile = {
  id: string
  full_name: string
  phone: string
  email?: string
  user_type: 'buyer' | 'seller' | 'both'
  created_at: string
  updated_at: string
}

export type Listing = {
  id: string
  seller_id: string
  year: number
  make: string
  model: string
  trim: string
  price: number
  mileage: number
  location: string
  condition: 'Like New' | 'Excellent' | 'Good' | 'Fair'
  title_status: string
  color: string
  interior_color: string
  transmission: string
  fuel_type: string
  vin: string
  description: string
  images: string[]
  contact_preference: 'message' | 'phone' | 'email' | 'both'
  status: 'active' | 'sold' | 'draft'
  negotiation_price?: number | null
  negotiation_buyer_id?: string | null
  created_at?: string
  updated_at?: string
  profiles?: { full_name?: string; phone?: string; email?: string }
}

export type Offer = {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  conversation_id: string | null
  amount: number
  status: 'pending' | 'accepted' | 'declined' | 'outbid'
  created_at: string
}

export type Conversation = {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  listing_title: string
  listing_image: string
  last_message: string
  last_message_at: string
  created_at?: string
  buyer?: { full_name: string }
  seller?: { full_name: string }
}

export type Message = {
  id: string
  conversation_id: string
  sender_id: string
  sender_name: string
  text: string
  created_at: string
}
