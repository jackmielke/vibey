ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_vibe_resident boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS vibe_resident_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_users_is_vibe_resident ON public.users(is_vibe_resident) WHERE is_vibe_resident = true;