export type Listing = {
  id: number
  year: number
  make: string
  model: string
  trim: string
  price: number
  mileage: number
  location: string
  verified: boolean
  condition: 'Like New' | 'Excellent' | 'Good' | 'Fair'
  image: string
  color?: string
  transmission?: string
  engine?: string
  vin?: string
  description?: string
}

export const listings: Listing[] = [
  {
    id: 1,
    year: 2021,
    make: 'BMW',
    model: 'M340i',
    trim: 'xDrive',
    price: 42500,
    mileage: 38200,
    location: 'Tampa, FL',
    verified: true,
    condition: 'Excellent',
    image: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800',
    color: 'Mineral White',
    transmission: '8-Speed Automatic',
    engine: '3.0L Turbocharged Inline-6',
    vin: 'WBA5U7C04M9E12345',
    description: 'One owner, always garage kept. Factory warranty still active. Recent service at BMW dealership — records available. Sport package, heads-up display, Harman Kardon sound system. Never tracked.',
  },
  {
    id: 2,
    year: 2020,
    make: 'Mercedes-Benz',
    model: 'C300',
    trim: '4MATIC',
    price: 28900,
    mileage: 52100,
    location: 'Miami, FL',
    verified: true,
    condition: 'Good',
    image: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800',
    color: 'Obsidian Black',
    transmission: '9-Speed Automatic',
    engine: '2.0L Turbocharged Inline-4',
    vin: '55SWF4JB4LU123456',
    description: 'Clean Carfax. No accidents. Burmester sound system, panoramic roof, AMG styling package. Tires replaced at 48k miles.',
  },
  {
    id: 3,
    year: 2019,
    make: 'Porsche',
    model: '911 Carrera',
    trim: 'Base',
    price: 89000,
    mileage: 24800,
    location: 'Fort Lauderdale, FL',
    verified: true,
    condition: 'Excellent',
    image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800',
    color: 'Guards Red',
    transmission: '7-Speed PDK',
    engine: '3.0L Twin-Turbo Flat-6',
    vin: 'WP0AA2A92KS123456',
    description: 'Full Porsche service history. Sport Chrono package, PASM sport suspension, 20-inch Carrera S wheels. No modifications. Second owner.',
  },
  {
    id: 4,
    year: 2022,
    make: 'Toyota',
    model: 'Camry',
    trim: 'XSE',
    price: 29500,
    mileage: 19300,
    location: 'Orlando, FL',
    verified: true,
    condition: 'Like New',
    image: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800',
    color: 'Midnight Black',
    transmission: '8-Speed Automatic',
    engine: '2.5L DOHC Inline-4',
    vin: '4T1G11AK6NU123456',
    description: 'Barely driven. Two-car household. Toyota Care maintenance done. All original window stickers and manuals included.',
  },
  {
    id: 5,
    year: 2021,
    make: 'Dodge',
    model: 'Charger',
    trim: 'Scat Pack',
    price: 43000,
    mileage: 31000,
    location: 'Atlanta, GA',
    verified: true,
    condition: 'Good',
    image: 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=800',
    color: 'F8 Green',
    transmission: '8-Speed Automatic',
    engine: '6.4L HEMI V8',
    vin: '2C3CDXGJ9MH123456',
    description: '485hp Scat Pack with Widebody package. Performance Pages data logging, adaptive damping suspension. Clean title.',
  },
  {
    id: 6,
    year: 2020,
    make: 'Chevrolet',
    model: 'Corvette',
    trim: 'Stingray',
    price: 67500,
    mileage: 18900,
    location: 'Dallas, TX',
    verified: true,
    condition: 'Excellent',
    image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800',
    color: 'Rapid Blue',
    transmission: '8-Speed DCT',
    engine: '6.2L LT2 V8',
    vin: '1G1YB2D41L5123456',
    description: 'Mid-engine C8 in pristine condition. Z51 performance package, magnetic ride control, front lift system. Weekend driver only. Climate-controlled storage.',
  },
]

export const getListing = (id: number) => listings.find((l) => l.id === id)

export const formatPrice = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

export const formatMileage = (n: number) =>
  new Intl.NumberFormat('en-US').format(n) + ' mi'
