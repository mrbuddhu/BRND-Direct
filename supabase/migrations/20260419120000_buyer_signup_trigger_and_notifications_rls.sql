-- Buyer signup from static HTML uses the browser anon key + RLS.
-- When "Confirm email" is enabled, signUp returns no session, so client inserts
-- into buyer_profiles fail (auth.uid() is null). This trigger runs as SECURITY DEFINER
-- and creates profiles + buyer_profiles from auth metadata instead.
-- Also adds missing INSERT policy on notifications.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r user_role;
  fn text;
  ln text;
  disp text;
  ph text;
  bn text;
BEGIN
  fn := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'first_name', '')), '');
  ln := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'last_name', '')), '');
  ph := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'phone', '')), '');
  disp := NULLIF(trim(concat_ws(' ', fn, ln)), '');

  BEGIN
    r := COALESCE(
      (NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'role', '')), ''))::user_role,
      'buyer'::user_role
    );
  EXCEPTION
    WHEN invalid_text_representation THEN
      r := 'buyer'::user_role;
  END;

  INSERT INTO public.profiles (id, role, first_name, last_name, phone, display_name, status)
  VALUES (NEW.id, r, fn, ln, ph, disp, 'pending'::account_status)
  ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role,
      first_name = COALESCE(EXCLUDED.first_name, public.profiles.first_name),
      last_name = COALESCE(EXCLUDED.last_name, public.profiles.last_name),
      phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
      display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
      status = EXCLUDED.status;

  IF r = 'buyer'::user_role THEN
    bn := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'business_name', '')), '');
    IF bn IS NOT NULL THEN
      INSERT INTO public.buyer_profiles (profile_id, business_name, business_type, ein_tax_id)
      VALUES (
        NEW.id,
        bn,
        NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'business_type', '')), ''),
        NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'ein_tax_id', '')), '')
      )
      ON CONFLICT (profile_id) DO UPDATE
      SET business_name = EXCLUDED.business_name,
          business_type = COALESCE(EXCLUDED.business_type, public.buyer_profiles.business_type),
          ein_tax_id = COALESCE(EXCLUDED.ein_tax_id, public.buyer_profiles.ein_tax_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Users insert own notifications" ON public.notifications;
CREATE POLICY "Users insert own notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (profile_id = auth.uid());
