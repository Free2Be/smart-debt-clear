This is a large scope — I'll keep the existing app intact and refactor in phases. Here's the plan. Approve and I'll execute phase by phase (or all at once if you prefer).

## Phase 0 — Security & config hygiene
- Delete committed `.env`, add `.gitignore` entries (`.env`, `.env.*`, `!.env.example`, `.dev.vars`), create `.env.example` with placeholders.
- Audit code for any hardcoded Supabase URL/key strings (currently only the auto-generated `client.ts` uses env — keep as-is).
- Confirm no secrets render in UI.

## Phase 1 — Database migrations (single migration, RLS on all)
New tables, all with `user_id`, RLS policies (select/insert/update/delete = `auth.uid() = user_id`), `created_at`, `updated_at` triggers where useful:
- `monthly_budget_settings` (per-month grocery/gas/other/safe_min/extra_debt/notes)
- `credit_card_payments` (amount, date, type: minimum/extra/statement/manual)
- `credit_card_interest_charges` (amount, apr_at_time, date)
- `credit_card_balance_history` (balance + statement_balance snapshots)
- `one_time_expenses` (name, amount, date, category, paid)
- `paycheck_allocations` (income_source_id, paycheck_date, allocated_to_type/_id, amount)

Also add to existing tables:
- `bills.kind` ('recurring'|'onetime') — or keep one_time_expenses separate (preferred: separate, as spec'd)
- `income_sources.second_payday_day` (int, nullable) — fixes semimonthly to support 1/15, 15/last
- `income_sources.custom_interval_days` (int, nullable) — fixes "custom" frequency

## Phase 2 — Shared payoff engine (`src/lib/payoff-engine.ts`)
Replace `simulatePayoff` with engine supporting:
- snowball / avalanche / custom (uses `credit_cards.priority`)
- monthly interest = balance × APR/12
- min-payment rollover when card paid off
- warnings: min < interest, balance growing, infeasible
- returns: months, payoff date, total interest, per-card timeline, monthly schedule, recommended target, baseline-vs-plan comparison
- Safety caps + non-negative balance enforcement
- Refactor Dashboard, Payoff, Charts, Budget to consume this engine — remove duplicates.

## Phase 3 — Monthly cashflow primitives (`src/lib/cashflow.ts`)
- `monthSelector` shared component + URL state
- `getMonthCashflow(month)` aggregates: income, bills, one-time, min payments, extra debt, grocery/gas/other, safe buffer → leftover
- `assignBillsToPaychecks(month)` — sort paychecks + due dates, assign each obligation to the latest paycheck before its due date; first paycheck gets pre-payday items flagged urgent

## Phase 4 — Page refactors
- **Dashboard**: month selector; summary cards (income/bills/min/extra/flexible/leftover/total debt/utilization/savings); "Needs attention" (overdue, due-3d, card-7d, high util, interest>min, negative cashflow); "Next paycheck plan"; payoff summary using engine.
- **Bills**: add one-time-expense support, paid-per-month via `bill_payments` (already month-scoped — verify), filters/sort/totals, overdue/due-soon badges, delete confirmations.
- **Income**: fix semimonthly (two configurable days), fix custom (interval_days OR manual one-off), show paydays this month + future + monthly total + average.
- **Credit Cards**: add payment dialog, add interest charge dialog, update balance (writes history), "mark statement paid" shortcut. Show: utilization, est monthly interest, pay-to-avoid-interest, post-statement pending, last payment, last interest, priority controls.
- **Budget**: month-scoped, edit grocery/gas/other inline (writes `monthly_budget_settings`), waterfall, shortfall warnings with suggestions.
- **Calendar**: add one-time expenses, statement due dates, payment events; click-day detail panel.
- **Payoff**: strategy + extra + what-if (already there); add up/down priority controls for custom; month-by-month schedule table; per-card payoff timeline; warnings; save what-if.
- **Charts**: rebuild on shared engine — income vs expenses 6mo, payoff projection (min vs plan), interest over time, utilization by card, bills by category, savings progress, monthly leftover.

## Phase 5 — Setup wizard, export, polish
- Wizard: welcome → income (multi) → bills (multi) → cards (multi) → grocery/gas/other → safe min → strategy → extra payment → finish.
- Export: clean CSV per entity; print-ready styled HTML PDF that auto-opens print dialog with summary tables + cashflow + payoff.
- Validation: zod schemas on all forms (non-neg amounts, APR ≥ 0, due_day 1–31).
- Delete confirmations everywhere; loading skeletons; empty states with CTAs; mobile pass.

## Technical notes
- All new tables get `update_updated_at_column` trigger.
- `bill_payments.period_month` is already date-keyed → confirms paying only marks the selected month.
- Date helpers consolidated in `src/lib/dates.ts` to avoid `new Date()` in deps.
- Replace `JSON.stringify` dep hacks with stable memoized keys.
- TypeScript types regenerate automatically after migration.

## Execution order I'll follow
1. Security/config (Phase 0) — fast.
2. Single migration with all schema changes (Phase 1) — needs your approval.
3. Engine + cashflow libs (Phases 2–3).
4. Page refactors (Phase 4) in this order: Dashboard, Bills, Income, Cards, Budget, Calendar, Payoff, Charts.
5. Wizard + export + validation polish (Phase 5).

This will span many tool calls and credits. **Reply "go" to start with Phase 0+1 (security + migration), or tell me to reorder/skip pieces.**