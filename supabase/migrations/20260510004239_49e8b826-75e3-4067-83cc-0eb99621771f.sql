
-- Shared updated_at trigger function (idempotent)
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============ income_sources additions ============
alter table public.income_sources
  add column if not exists second_payday_day integer,
  add column if not exists custom_interval_days integer;

-- ============ monthly_budget_settings ============
create table if not exists public.monthly_budget_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  month date not null,
  grocery_budget numeric not null default 0,
  gas_budget numeric not null default 0,
  other_budget numeric not null default 0,
  safe_minimum_balance numeric not null default 0,
  extra_debt_payment numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);
alter table public.monthly_budget_settings enable row level security;
create policy "own mbs select" on public.monthly_budget_settings for select using (auth.uid() = user_id);
create policy "own mbs insert" on public.monthly_budget_settings for insert with check (auth.uid() = user_id);
create policy "own mbs update" on public.monthly_budget_settings for update using (auth.uid() = user_id);
create policy "own mbs delete" on public.monthly_budget_settings for delete using (auth.uid() = user_id);
create trigger trg_mbs_updated before update on public.monthly_budget_settings
  for each row execute function public.update_updated_at_column();

-- ============ credit_card_payments ============
create table if not exists public.credit_card_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  credit_card_id uuid not null,
  payment_date date not null,
  amount numeric not null default 0,
  payment_type text not null default 'manual',
  notes text,
  created_at timestamptz not null default now()
);
alter table public.credit_card_payments enable row level security;
create policy "own ccp select" on public.credit_card_payments for select using (auth.uid() = user_id);
create policy "own ccp insert" on public.credit_card_payments for insert with check (auth.uid() = user_id);
create policy "own ccp update" on public.credit_card_payments for update using (auth.uid() = user_id);
create policy "own ccp delete" on public.credit_card_payments for delete using (auth.uid() = user_id);
create index if not exists idx_ccp_card on public.credit_card_payments(credit_card_id);

-- ============ credit_card_interest_charges ============
create table if not exists public.credit_card_interest_charges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  credit_card_id uuid not null,
  charge_date date not null,
  amount numeric not null default 0,
  apr_at_time numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.credit_card_interest_charges enable row level security;
create policy "own ccic select" on public.credit_card_interest_charges for select using (auth.uid() = user_id);
create policy "own ccic insert" on public.credit_card_interest_charges for insert with check (auth.uid() = user_id);
create policy "own ccic update" on public.credit_card_interest_charges for update using (auth.uid() = user_id);
create policy "own ccic delete" on public.credit_card_interest_charges for delete using (auth.uid() = user_id);
create index if not exists idx_ccic_card on public.credit_card_interest_charges(credit_card_id);

-- ============ credit_card_balance_history ============
create table if not exists public.credit_card_balance_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  credit_card_id uuid not null,
  balance_date date not null,
  balance numeric not null default 0,
  statement_balance numeric not null default 0,
  created_at timestamptz not null default now()
);
alter table public.credit_card_balance_history enable row level security;
create policy "own ccbh select" on public.credit_card_balance_history for select using (auth.uid() = user_id);
create policy "own ccbh insert" on public.credit_card_balance_history for insert with check (auth.uid() = user_id);
create policy "own ccbh update" on public.credit_card_balance_history for update using (auth.uid() = user_id);
create policy "own ccbh delete" on public.credit_card_balance_history for delete using (auth.uid() = user_id);
create index if not exists idx_ccbh_card on public.credit_card_balance_history(credit_card_id);

-- ============ one_time_expenses ============
create table if not exists public.one_time_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  amount numeric not null default 0,
  expense_date date not null,
  category text not null default 'Other',
  notes text,
  paid boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.one_time_expenses enable row level security;
create policy "own ote select" on public.one_time_expenses for select using (auth.uid() = user_id);
create policy "own ote insert" on public.one_time_expenses for insert with check (auth.uid() = user_id);
create policy "own ote update" on public.one_time_expenses for update using (auth.uid() = user_id);
create policy "own ote delete" on public.one_time_expenses for delete using (auth.uid() = user_id);
create trigger trg_ote_updated before update on public.one_time_expenses
  for each row execute function public.update_updated_at_column();

-- ============ paycheck_allocations ============
create table if not exists public.paycheck_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  income_source_id uuid not null,
  paycheck_date date not null,
  allocated_to_type text not null,
  allocated_to_id uuid,
  amount numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.paycheck_allocations enable row level security;
create policy "own pa select" on public.paycheck_allocations for select using (auth.uid() = user_id);
create policy "own pa insert" on public.paycheck_allocations for insert with check (auth.uid() = user_id);
create policy "own pa update" on public.paycheck_allocations for update using (auth.uid() = user_id);
create policy "own pa delete" on public.paycheck_allocations for delete using (auth.uid() = user_id);
create index if not exists idx_pa_paycheck on public.paycheck_allocations(income_source_id, paycheck_date);
