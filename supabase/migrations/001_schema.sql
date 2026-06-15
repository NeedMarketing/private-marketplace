-- ─── Extensions ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Profiles ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL DEFAULT '',
  phone       TEXT DEFAULT '',
  user_type   TEXT CHECK (user_type IN ('buyer', 'seller', 'both')) DEFAULT 'both',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are publicly readable"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, user_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'both')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Listings ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.listings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year                INTEGER NOT NULL,
  make                TEXT NOT NULL,
  model               TEXT NOT NULL,
  trim                TEXT DEFAULT '',
  price               INTEGER NOT NULL,
  mileage             INTEGER NOT NULL DEFAULT 0,
  location            TEXT NOT NULL DEFAULT '',
  condition           TEXT NOT NULL CHECK (condition IN ('Like New', 'Excellent', 'Good', 'Fair')),
  title_status        TEXT NOT NULL DEFAULT 'Clean title',
  color               TEXT DEFAULT '',
  interior_color      TEXT DEFAULT '',
  transmission        TEXT DEFAULT 'Automatic',
  fuel_type           TEXT DEFAULT 'Gas',
  vin                 TEXT DEFAULT '',
  description         TEXT DEFAULT '',
  images              TEXT[] DEFAULT '{}',
  contact_preference  TEXT DEFAULT 'message' CHECK (contact_preference IN ('message', 'phone', 'both')),
  status              TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'draft')),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active listings are publicly readable"
  ON public.listings FOR SELECT USING (status IN ('active', 'sold'));

CREATE POLICY "Sellers can create listings"
  ON public.listings FOR INSERT WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their own listings"
  ON public.listings FOR UPDATE USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete their own listings"
  ON public.listings FOR DELETE USING (auth.uid() = seller_id);

CREATE INDEX IF NOT EXISTS listings_seller_id_idx ON public.listings(seller_id);
CREATE INDEX IF NOT EXISTS listings_status_idx ON public.listings(status);
CREATE INDEX IF NOT EXISTS listings_created_at_idx ON public.listings(created_at DESC);

-- ─── Conversations ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.conversations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id        UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  buyer_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_title     TEXT NOT NULL DEFAULT '',
  listing_image     TEXT DEFAULT '',
  last_message      TEXT DEFAULT '',
  last_message_at   TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, buyer_id)
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their conversations"
  ON public.conversations FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Buyers can start conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Participants can update conversation metadata"
  ON public.conversations FOR UPDATE
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE INDEX IF NOT EXISTS conversations_buyer_id_idx ON public.conversations(buyer_id);
CREATE INDEX IF NOT EXISTS conversations_seller_id_idx ON public.conversations(seller_id);

-- ─── Messages ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_name       TEXT NOT NULL DEFAULT '',
  text              TEXT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Only conversation participants can read messages
CREATE POLICY "Participants can read messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
  );

-- Only conversation participants can send messages
CREATE POLICY "Participants can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
  );

CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON public.messages(created_at);

-- ─── Updated_at triggers ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── Realtime ────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- ─── Storage bucket for listing images ───────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-images', 'listing-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'listing-images');

CREATE POLICY "Authenticated users can upload images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'listing-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'listing-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ─── Seed data (demo listings) ───────────────────────────────────────────────

-- These 6 demo listings appear without a seller (seller_id is a placeholder profile).
-- To include real seed data, create a user in Supabase Auth first and use their UUID.
-- Example (replace <seller-uuid> with a real profile id):
--
-- INSERT INTO public.listings (seller_id, year, make, model, trim, price, mileage, location, condition, title_status, color, interior_color, transmission, fuel_type, vin, description, images, contact_preference, status)
-- VALUES (
--   '<seller-uuid>',
--   2022, 'Porsche', '911', 'Carrera S', 129500, 8200, 'Los Angeles, CA',
--   'Like New', 'Clean title', 'GT Silver Metallic', 'Black', 'PDK', 'Gas',
--   'WP0AB2A97NS247862',
--   'Stunning 2022 Porsche 911 Carrera S in pristine condition...',
--   ARRAY['https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=900'],
--   'message', 'active'
-- );
