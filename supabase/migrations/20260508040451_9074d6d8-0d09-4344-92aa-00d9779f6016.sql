
-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- user_settings
create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payoff_strategy text not null default 'avalanche' check (payoff_strategy in ('snowball','avalanche','custom')),
  extra_monthly_payment numeric(12,2) not null default 0,
  safe_minimum_balance numeric(12,2) not null default 0,
  theme text not null default 'system',
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;
create policy "own settings select" on public.user_settings for select using (auth.uid() = user_id);
create policy "own settings insert" on public.user_settings for insert with check (auth.uid() = user_id);
create policy "own settings update" on public.user_settings for update using (auth.uid() = user_id);

-- income_sources
create table public.income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null default 0,
  payday_date date not null,
  frequency text not null check (frequency in ('weekly','biweekly','semimonthly','monthly','custom')),
  created_at timestamptz not null default now()
);
alter table public.income_sources enable row level security;
create policy "own income select" on public.income_sources for select using (auth.uid() = user_id);
create policy "own income insert" on public.income_sources for insert with check (auth.uid() = user_id);
create policy "own income update" on public.income_sources for update using (auth.uid() = user_id);
create policy "own income delete" on public.income_sources for delete using (auth.uid() = user_id);

-- bills
create table public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null default 0,
  due_day int not null check (due_day between 1 and 31),
  category text not null default 'Other',
  autopay boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.bills enable row level security;
create policy "own bills select" on public.bills for select using (auth.uid() = user_id);
create policy "own bills insert" on public.bills for insert with check (auth.uid() = user_id);
create policy "own bills update" on public.bills for update using (auth.uid() = user_id);
create policy "own bills delete" on public.bills for delete using (auth.uid() = user_id);

-- bill_payments
create table public.bill_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bill_id uuid not null references public.bills(id) on delete cascade,
  period_month date not null,
  paid_at timestamptz not null default now(),
  unique (bill_id, period_month)
);
alter table public.bill_payments enable row level security;
create policy "own pay select" on public.bill_payments for select using (auth.uid() = user_id);
create policy "own pay insert" on public.bill_payments for insert with check (auth.uid() = user_id);
create policy "own pay delete" on public.bill_payments for delete using (auth.uid() = user_id);

-- credit_cards
create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  balance numeric(12,2) not null default 0,
  credit_limit numeric(12,2) not null default 0,
  apr numeric(6,3) not null default 0,
  minimum_payment numeric(12,2) not null default 0,
  due_day int check (due_day between 1 and 31),
  statement_day int check (statement_day between 1 and 31),
  priority int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.credit_cards enable row level security;
create policy "own cards select" on public.credit_cards for select using (auth.uid() = user_id);
create policy "own cards insert" on public.credit_cards for insert with check (auth.uid() = user_id);
create policy "own cards update" on public.credit_cards for update using (auth.uid() = user_id);
create policy "own cards delete" on public.credit_cards for delete using (auth.uid() = user_id);

-- savings_accounts
create table public.savings_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  balance numeric(12,2) not null default 0,
  goal numeric(12,2) not null default 0,
  bucket text not null default 'general',
  created_at timestamptz not null default now()
);
alter table public.savings_accounts enable row level security;
create policy "own savings select" on public.savings_accounts for select using (auth.uid() = user_id);
create policy "own savings insert" on public.savings_accounts for insert with check (auth.uid() = user_id);
create policy "own savings update" on public.savings_accounts for update using (auth.uid() = user_id);
create policy "own savings delete" on public.savings_accounts for delete using (auth.uid() = user_id);

-- auto-create profile + settings on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
