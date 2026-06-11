-- User access scope: office (firm) / single client / multiple clients
-- Adds firm-level access on profiles + a user<->company link table, and
-- rewrites companies/reports RLS to honor all three access modes while
-- preserving subscription-window gating.

-- 1) Office-level access: a profile can be granted a whole firm (all its companies)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS firm_id uuid REFERENCES public.firms(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_firm_id ON public.profiles(firm_id);

-- 2) Multi-client access: explicit user <-> company grants
CREATE TABLE IF NOT EXISTS public.user_companies (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, company_id)
);
CREATE INDEX IF NOT EXISTS idx_user_companies_user ON public.user_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_companies_company ON public.user_companies(company_id);
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "view own company links or admin" ON public.user_companies;
CREATE POLICY "view own company links or admin" ON public.user_companies
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins manage company links" ON public.user_companies;
CREATE POLICY "admins manage company links" ON public.user_companies
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) Central access check (SECURITY DEFINER avoids RLS recursion and centralizes
--    subscription-window gating across all three access modes).
CREATE OR REPLACE FUNCTION public.user_can_access_company(_user_id uuid, _company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id
      AND (p.subscription_start IS NULL OR p.subscription_start <= now())
      AND (p.subscription_end IS NULL OR p.subscription_end >= now())
      AND (
        p.company_id = _company_id
        OR (p.firm_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.companies c
              WHERE c.id = _company_id AND c.firm_id = p.firm_id))
        OR EXISTS (
              SELECT 1 FROM public.user_companies uc
              WHERE uc.user_id = _user_id AND uc.company_id = _company_id)
      )
  );
$$;

-- 4) Rewrite RLS to use the central check
DROP POLICY IF EXISTS "view own or admin" ON public.companies;
CREATE POLICY "view own or admin" ON public.companies FOR SELECT USING (
  public.has_role(auth.uid(), 'admin') OR public.user_can_access_company(auth.uid(), id)
);

DROP POLICY IF EXISTS "view reports of own company or admin" ON public.reports;
CREATE POLICY "view reports of own company or admin" ON public.reports FOR SELECT USING (
  public.has_role(auth.uid(), 'admin') OR public.user_can_access_company(auth.uid(), company_id)
);

-- 5) Firms visible to users with firm-level access too
DROP POLICY IF EXISTS "view own firm or admin" ON public.firms;
CREATE POLICY "view own firm or admin" ON public.firms FOR SELECT USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.firm_id = firms.id
      AND (p.subscription_start IS NULL OR p.subscription_start <= now())
      AND (p.subscription_end IS NULL OR p.subscription_end >= now())
  )
  OR EXISTS (
    SELECT 1 FROM public.companies c
    JOIN public.profiles p ON p.company_id = c.id
    WHERE p.id = auth.uid() AND c.firm_id = firms.id
      AND (p.subscription_start IS NULL OR p.subscription_start <= now())
      AND (p.subscription_end IS NULL OR p.subscription_end >= now())
  )
);
