
CREATE TABLE public.firms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.firms ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.companies ADD COLUMN firm_id uuid REFERENCES public.firms(id) ON DELETE SET NULL;
CREATE INDEX idx_companies_firm_id ON public.companies(firm_id);

CREATE POLICY "admins manage firms" ON public.firms
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "view own firm or admin" ON public.firms
  FOR SELECT USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.companies c
      JOIN public.profiles p ON p.company_id = c.id
      WHERE p.id = auth.uid() AND c.firm_id = firms.id
    )
  );
