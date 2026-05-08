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

const num = (v: unknown) => (v == null ? 0 : Number(v));

function uid(user: { id: string } | null) {
  return user?.id ?? "";
}

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
        // fallback: insert
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
