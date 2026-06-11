-- Fix broken access control by enforcing subscription dates on RLS

DROP POLICY IF EXISTS "view own or admin" ON public.companies;
CREATE POLICY "view own or admin" ON public.companies FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND company_id = companies.id
        AND (subscription_start IS NULL OR subscription_start <= now())
        AND (subscription_end IS NULL OR subscription_end >= now())
    )
);

DROP POLICY IF EXISTS "view reports of own company or admin" ON public.reports;
CREATE POLICY "view reports of own company or admin" ON public.reports FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND company_id = reports.company_id
        AND (subscription_start IS NULL OR subscription_start <= now())
        AND (subscription_end IS NULL OR subscription_end >= now())
    )
);

DROP POLICY IF EXISTS "view own firm or admin" ON public.firms;
CREATE POLICY "view own firm or admin" ON public.firms
    FOR SELECT USING (
      has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.companies c
        JOIN public.profiles p ON p.company_id = c.id
        WHERE p.id = auth.uid() AND c.firm_id = firms.id
        AND (p.subscription_start IS NULL OR p.subscription_start <= now())
        AND (p.subscription_end IS NULL OR p.subscription_end >= now())
      )
    );
