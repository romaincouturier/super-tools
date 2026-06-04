-- Add demo_mode column to profiles (per-user display masking)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS demo_mode boolean DEFAULT false NOT NULL;

-- Allow each authenticated user to update their own profile (for demo_mode toggle)
CREATE POLICY "User can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow each authenticated user to read their own profile
CREATE POLICY "User can read own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);
