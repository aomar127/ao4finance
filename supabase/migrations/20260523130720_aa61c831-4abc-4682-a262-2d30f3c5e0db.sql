
ALTER TABLE public.firms
  ADD COLUMN IF NOT EXISTS brand_name_ar text,
  ADD COLUMN IF NOT EXISTS brand_name_en text,
  ADD COLUMN IF NOT EXISTS brand_tagline text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS primary_color text,
  ADD COLUMN IF NOT EXISTS accent_color text,
  ADD COLUMN IF NOT EXISTS dark_color text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_address text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('firm-brands', 'firm-brands', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public read firm-brands"
ON storage.objects FOR SELECT
USING (bucket_id = 'firm-brands');

CREATE POLICY "admins upload firm-brands"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'firm-brands' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update firm-brands"
ON storage.objects FOR UPDATE
USING (bucket_id = 'firm-brands' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete firm-brands"
ON storage.objects FOR DELETE
USING (bucket_id = 'firm-brands' AND public.has_role(auth.uid(), 'admin'));
