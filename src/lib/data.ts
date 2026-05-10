import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
import { toast } from "sonner";

// ------- types -------
export interface IncomeSource {
  id: string;
  name: string;
  amount: number;
  payday_date: string;
  frequency: "weekly" | "biweekly" | "semimonthly" | "monthly" | "custom";
  second_payday_day?: number | null;
  custom_interval_days?: number | null;
}
export interface Bill {
  id: string;
  name: string;
  amount: number;
  due_day: number;
  category: string;
  autopay: boolean;
  notes: string | null;
}
export interface BillPayment {
  id: string;
  bill_id: string;
  period_month: string;
}
export interface CreditCard {
  id: string;
  name: string;
  balance: number;
  credit_limit: number;
  apr: number;
  minimum_payment: number;
  due_day: number | null;
  statement_day: number | null;
  priority: number;
  statement_balance: number;
  statement_due_date: string | null;
}
export interface SavingsAccount {
  id: string;
  name: string;
  balance: number;
  goal: number;
  bucket: string;
}
export interface UserSettings {
  user_id: string;
  payoff_strategy: "snowball" | "avalanche" | "custom";
  extra_monthly_payment: number;
  safe_minimum_balance: number;
  theme: string;
}
export interface MonthlyBudgetSettings {
  id: string;
  user_id: string;
  month: string; // YYYY-MM-01
  grocery_budget: number;
  gas_budget: number;
  other_budget: number;
  safe_minimum_balance: number;
  extra_debt_payment: number;
  notes: string | null;
}
export interface OneTimeExpense {
  id: string;
  name: string;
  amount: number;
  expense_date: string;
  category: string;
  notes: string | null;
  paid: boolean;
}
export interface CardPayment {
  id: string;
  credit_card_id: string;
  payment_date: string;
  amount: number;
  payment_type: "minimum" | "extra" | "statement" | "manual" | string;
  notes: string | null;
}
export interface CardInterestCharge {
  id: string;
  credit_card_id: string;
  charge_date: string;
  amount: number;
  apr_at_time: number;
  notes: string | null;
}

const num = (v: unknown) => (v == null ? 0 : Number(v));
const uid = (user: { id: string } | null) => user?.id ?? "";

// ------- income -------
export function useIncome() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["income", uid(user)],
    enabled: !!user,
    queryFn: async (): Promise<IncomeSource[]> => {
      const { data, error } = await supabase.from("income_sources").select("*").order("payday_date");
      if (error) throw error;
      return (data ?? []).map(r => ({ ...r, amount: num(r.amount) })) as IncomeSource[];
    },
  });
}
export function useUpsertIncome() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (row: Partial<IncomeSource> & { id?: string }) => {
      const payload = { ...row, user_id: user!.id };
      const { error } = row.id
        ? await supabase.from("income_sources").update(payload as never).eq("id", row.id)
        : await supabase.from("income_sources").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["income"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}
export function useDeleteIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("income_sources").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["income"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ------- bills -------
export function useBills() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["bills", uid(user)],
    enabled: !!user,
    queryFn: async (): Promise<Bill[]> => {
      const { data, error } = await supabase.from("bills").select("*").order("due_day");
      if (error) throw error;
      return (data ?? []).map(r => ({ ...r, amount: num(r.amount) })) as Bill[];
    },
  });
}
export function useUpsertBill() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (row: Partial<Bill> & { id?: string }) => {
      const payload = { ...row, user_id: user!.id };
      const { error } = row.id
        ? await supabase.from("bills").update(payload as never).eq("id", row.id)
        : await supabase.from("bills").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bills"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}
export function useDeleteBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bills").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bills"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ------- bill payments (per month) -------
export function useBillPayments(periodMonth: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["bill_payments", uid(user), periodMonth],
    enabled: !!user,
    queryFn: async (): Promise<BillPayment[]> => {
      const { data, error } = await supabase
        .from("bill_payments")
        .select("*")
        .eq("period_month", periodMonth);
      if (error) throw error;
      return data as BillPayment[];
    },
  });
}
export function useTogglePaid() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ billId, periodMonth, paid }: { billId: string; periodMonth: string; paid: boolean }) => {
      if (paid) {
        const { error } = await supabase
          .from("bill_payments")
          .insert({ user_id: user!.id, bill_id: billId, period_month: periodMonth });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("bill_payments")
          .delete()
          .eq("bill_id", billId)
          .eq("period_month", periodMonth);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bill_payments"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ------- credit cards -------
export function useCards() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["cards", uid(user)],
    enabled: !!user,
    queryFn: async (): Promise<CreditCard[]> => {
      const { data, error } = await supabase.from("credit_cards").select("*").order("priority");
      if (error) throw error;
      return (data ?? []).map(r => ({
        ...r,
        balance: num(r.balance),
        credit_limit: num(r.credit_limit),
        apr: num(r.apr),
        minimum_payment: num(r.minimum_payment),
        statement_balance: num(r.statement_balance),
      })) as CreditCard[];
    },
  });
}
export function useUpsertCard() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (row: Partial<CreditCard> & { id?: string }) => {
      const payload = { ...row, user_id: user!.id };
      const { error } = row.id
        ? await supabase.from("credit_cards").update(payload as never).eq("id", row.id)
        : await supabase.from("credit_cards").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cards"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}
export function useDeleteCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("credit_cards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cards"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ------- credit card payments -------
export function useCardPayments(cardId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["card_payments", uid(user), cardId ?? "all"],
    enabled: !!user,
    queryFn: async (): Promise<CardPayment[]> => {
      let q = supabase.from("credit_card_payments").select("*").order("payment_date", { ascending: false });
      if (cardId) q = q.eq("credit_card_id", cardId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(r => ({ ...r, amount: num(r.amount) })) as CardPayment[];
    },
  });
}
export function useAddCardPayment() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { card: CreditCard; amount: number; payment_date: string; payment_type: string; notes?: string | null }) => {
      const { card, amount, payment_date, payment_type, notes } = input;
      const { error: e1 } = await supabase.from("credit_card_payments").insert({
        user_id: user!.id, credit_card_id: card.id, amount, payment_date, payment_type, notes: notes ?? null,
      });
      if (e1) throw e1;
      const newBalance = Math.max(0, card.balance - amount);
      const newStatement = payment_type === "statement"
        ? Math.max(0, card.statement_balance - amount)
        : Math.max(0, card.statement_balance - Math.min(amount, card.statement_balance));
      const { error: e2 } = await supabase.from("credit_cards").update({
        balance: newBalance,
        statement_balance: newStatement,
      } as never).eq("id", card.id);
      if (e2) throw e2;
      await supabase.from("credit_card_balance_history").insert({
        user_id: user!.id, credit_card_id: card.id, balance_date: payment_date,
        balance: newBalance, statement_balance: newStatement,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cards"] });
      qc.invalidateQueries({ queryKey: ["card_payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ------- credit card interest charges -------
export function useCardInterestCharges(cardId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["card_interest", uid(user), cardId ?? "all"],
    enabled: !!user,
    queryFn: async (): Promise<CardInterestCharge[]> => {
      let q = supabase.from("credit_card_interest_charges").select("*").order("charge_date", { ascending: false });
      if (cardId) q = q.eq("credit_card_id", cardId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(r => ({ ...r, amount: num(r.amount), apr_at_time: num(r.apr_at_time) })) as CardInterestCharge[];
    },
  });
}
export function useAddInterestCharge() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { card: CreditCard; amount: number; charge_date: string; apr_at_time?: number; notes?: string | null }) => {
      const { card, amount, charge_date, apr_at_time, notes } = input;
      const { error: e1 } = await supabase.from("credit_card_interest_charges").insert({
        user_id: user!.id, credit_card_id: card.id, amount, charge_date,
        apr_at_time: apr_at_time ?? card.apr, notes: notes ?? null,
      });
      if (e1) throw e1;
      const newBalance = card.balance + amount;
      const { error: e2 } = await supabase.from("credit_cards").update({
        balance: newBalance,
      } as never).eq("id", card.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cards"] });
      qc.invalidateQueries({ queryKey: ["card_interest"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ------- one-time expenses -------
export function useOneTimeExpenses() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["one_time_expenses", uid(user)],
    enabled: !!user,
    queryFn: async (): Promise<OneTimeExpense[]> => {
      const { data, error } = await supabase.from("one_time_expenses").select("*").order("expense_date");
      if (error) throw error;
      return (data ?? []).map(r => ({ ...r, amount: num(r.amount) })) as OneTimeExpense[];
    },
  });
}
export function useUpsertOneTimeExpense() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (row: Partial<OneTimeExpense> & { id?: string }) => {
      const payload = { ...row, user_id: user!.id };
      const { error } = row.id
        ? await supabase.from("one_time_expenses").update(payload as never).eq("id", row.id)
        : await supabase.from("one_time_expenses").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["one_time_expenses"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}
export function useDeleteOneTimeExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("one_time_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["one_time_expenses"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ------- monthly budget settings -------
export function useMonthlyBudget(month: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["monthly_budget", uid(user), month],
    enabled: !!user,
    queryFn: async (): Promise<MonthlyBudgetSettings | null> => {
      const { data, error } = await supabase
        .from("monthly_budget_settings")
        .select("*")
        .eq("month", month)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        grocery_budget: num(data.grocery_budget),
        gas_budget: num(data.gas_budget),
        other_budget: num(data.other_budget),
        safe_minimum_balance: num(data.safe_minimum_balance),
        extra_debt_payment: num(data.extra_debt_payment),
      } as MonthlyBudgetSettings;
    },
  });
}
export function useUpsertMonthlyBudget() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (row: Partial<MonthlyBudgetSettings> & { month: string }) => {
      const payload = { ...row, user_id: user!.id };
      const { error } = await supabase
        .from("monthly_budget_settings")
        .upsert(payload as never, { onConflict: "user_id,month" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["monthly_budget"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ------- savings -------
export function useSavings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["savings", uid(user)],
    enabled: !!user,
    queryFn: async (): Promise<SavingsAccount[]> => {
      const { data, error } = await supabase.from("savings_accounts").select("*").order("created_at");
      if (error) throw error;
      return (data ?? []).map(r => ({ ...r, balance: num(r.balance), goal: num(r.goal) })) as SavingsAccount[];
    },
  });
}
export function useUpsertSavings() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (row: Partial<SavingsAccount> & { id?: string }) => {
      const payload = { ...row, user_id: user!.id };
      const { error } = row.id
        ? await supabase.from("savings_accounts").update(payload as never).eq("id", row.id)
        : await supabase.from("savings_accounts").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["savings"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}
export function useDeleteSavings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("savings_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["savings"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ------- settings -------
export function useSettings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["settings", uid(user)],
    enabled: !!user,
    queryFn: async (): Promise<UserSettings> => {
      const { data, error } = await supabase.from("user_settings").select("*").maybeSingle();
      if (error) throw error;
      if (!data) {
        await supabase.from("user_settings").insert({ user_id: user!.id });
        return {
          user_id: user!.id,
          payoff_strategy: "avalanche",
          extra_monthly_payment: 0,
          safe_minimum_balance: 0,
          theme: "system",
        };
      }
      return {
        ...data,
        extra_monthly_payment: num(data.extra_monthly_payment),
        safe_minimum_balance: num(data.safe_minimum_balance),
      } as UserSettings;
    },
  });
}
export function useUpdateSettings() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (row: Partial<UserSettings>) => {
      const { error } = await supabase
        .from("user_settings")
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}
