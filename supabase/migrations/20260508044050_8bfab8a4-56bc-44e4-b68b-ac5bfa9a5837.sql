ALTER TABLE public.credit_cards
  ADD COLUMN IF NOT EXISTS statement_balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS statement_due_date date;