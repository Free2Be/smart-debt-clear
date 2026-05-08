export const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0,
  );
export const fmtMoneyCents = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number.isFinite(n) ? n : 0);

export const BILL_CATEGORIES = [
  "Mortgage/Rent",
  "Utilities",
  "Insurance",
  "Phone",
  "Internet",
  "Vehicle",
  "Subscriptions",
  "Food",
  "Gas",
  "Debt Payments",
  "Other",
] as const;

export const SAVINGS_BUCKETS = [
  { value: "emergency", label: "Emergency Fund" },
  { value: "general", label: "General Savings" },
  { value: "house", label: "House Fund" },
  { value: "vacation", label: "Vacation Fund" },
  { value: "custom", label: "Custom" },
] as const;

// Income occurrences in a given month
export function incomeOccurrencesInMonth(
  payday: string, // ISO date
  frequency: "weekly" | "biweekly" | "semimonthly" | "monthly" | "custom",
  year: number,
  month: number, // 0-indexed
): Date[] {
  const start = new Date(payday + "T00:00:00");
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const out: Date[] = [];

  if (frequency === "monthly" || frequency === "custom") {
    const day = start.getDate();
    const lastDay = monthEnd.getDate();
    const d = new Date(year, month, Math.min(day, lastDay));
    if (d >= start) out.push(d);
    return out;
  }
  if (frequency === "semimonthly") {
    // Two paydays based on the original day and ~14 days later
    const d1 = start.getDate();
    const lastDay = monthEnd.getDate();
    const a = new Date(year, month, Math.min(d1, lastDay));
    const b = new Date(year, month, Math.min(d1 + 14, lastDay));
    if (a >= start) out.push(a);
    if (b >= start && b.getTime() !== a.getTime()) out.push(b);
    return out;
  }
  const stepDays = frequency === "weekly" ? 7 : 14;
  // Walk forward from start by step until past month end
  const cursor = new Date(start);
  while (cursor < monthStart) cursor.setDate(cursor.getDate() + stepDays);
  while (cursor <= monthEnd) {
    out.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + stepDays);
  }
  return out;
}

export function monthlyIncomeAmount(
  amount: number,
  frequency: "weekly" | "biweekly" | "semimonthly" | "monthly" | "custom",
  occurrences: number,
): number {
  // Use occurrences for the actual selected month
  return amount * occurrences;
}

// Credit card payoff simulation
export interface CardSim {
  id: string;
  name: string;
  balance: number;
  apr: number;
  minimum_payment: number;
}

export interface PayoffResult {
  months: number;
  totalInterest: number;
  perCard: Record<string, { months: number; interest: number }>;
}

export function simulatePayoff(
  cards: CardSim[],
  strategy: "snowball" | "avalanche" | "custom",
  extraMonthly: number,
  customOrderIds?: string[],
): PayoffResult {
  const list = cards.map(c => ({ ...c }));
  const order = (() => {
    if (strategy === "snowball") return [...list].sort((a, b) => a.balance - b.balance).map(c => c.id);
    if (strategy === "avalanche") return [...list].sort((a, b) => b.apr - a.apr).map(c => c.id);
    return customOrderIds ?? list.map(c => c.id);
  })();

  const perCard: Record<string, { months: number; interest: number }> = {};
  list.forEach(c => (perCard[c.id] = { months: 0, interest: 0 }));

  let months = 0;
  let totalInterest = 0;
  const map = new Map(list.map(c => [c.id, c]));

  while (Array.from(map.values()).some(c => c.balance > 0.01)) {
    months++;
    if (months > 600) break; // safety
    let extra = extraMonthly;
    // Apply minimum payments + interest
    for (const c of map.values()) {
      if (c.balance <= 0) continue;
      const monthlyRate = c.apr / 100 / 12;
      const interest = c.balance * monthlyRate;
      c.balance += interest;
      totalInterest += interest;
      perCard[c.id].interest += interest;
      const pay = Math.min(c.minimum_payment, c.balance);
      c.balance -= pay;
    }
    // Apply extra to highest-priority unpaid card
    for (const id of order) {
      if (extra <= 0) break;
      const c = map.get(id);
      if (!c || c.balance <= 0) continue;
      const pay = Math.min(extra, c.balance);
      c.balance -= pay;
      extra -= pay;
    }
    for (const id of order) {
      const c = map.get(id);
      if (c && c.balance > 0) perCard[id].months = months;
    }
  }
  return { months, totalInterest, perCard };
}

export function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}
