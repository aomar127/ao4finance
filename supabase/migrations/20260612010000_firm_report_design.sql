-- Per-firm report design selection
-- Each office (firm) chooses which financial-report design applies to its clients.
-- 'ln' = "تصميم لغة الأرقام" (the current/default design).
ALTER TABLE public.firms
  ADD COLUMN IF NOT EXISTS report_design text NOT NULL DEFAULT 'ln';
