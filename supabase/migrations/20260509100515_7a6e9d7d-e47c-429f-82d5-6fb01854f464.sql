ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_start timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_end timestamptz;

CREATE OR REPLACE FUNCTION public.is_subscription_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND (subscription_start IS NULL OR subscription_start <= now())
      AND (subscription_end IS NULL OR subscription_end >= now())
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_subscription_active(uuid) TO anon, authenticated, service_role;