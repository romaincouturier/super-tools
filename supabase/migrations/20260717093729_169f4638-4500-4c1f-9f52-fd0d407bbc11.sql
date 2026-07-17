-- mission_media: remove public SELECT + broad authenticated permissive policies
DROP POLICY IF EXISTS "Users can view mission media" ON public.mission_media;
DROP POLICY IF EXISTS "Authenticated users can insert mission media" ON public.mission_media;
DROP POLICY IF EXISTS "Authenticated users can update mission media" ON public.mission_media;
DROP POLICY IF EXISTS "Authenticated users can delete mission media" ON public.mission_media;

CREATE POLICY "Staff can view mission media"
  ON public.mission_media FOR SELECT TO authenticated
  USING (public.is_staff_user());

CREATE POLICY "Staff can insert mission media"
  ON public.mission_media FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_user());

CREATE POLICY "Staff can update mission media"
  ON public.mission_media FOR UPDATE TO authenticated
  USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

CREATE POLICY "Staff can delete mission media"
  ON public.mission_media FOR DELETE TO authenticated
  USING (public.is_staff_user());

-- woocommerce_coupons: remove permissive true policies
DROP POLICY IF EXISTS "Authenticated users can read coupons" ON public.woocommerce_coupons;
DROP POLICY IF EXISTS "Authenticated users can insert coupons" ON public.woocommerce_coupons;