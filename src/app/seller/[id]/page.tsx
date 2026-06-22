import { redirect } from 'next/navigation'

// Seller profiles are temporarily disabled — will be re-enabled as we scale.
// (Full implementation preserved in git history.)
export default function SellerProfileDisabled() {
  redirect('/browse')
}
