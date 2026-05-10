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

// ---------- Date helpers ----------
export const monthKey = (year: number, month: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}-01`;

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

export function parseISODate(s: string): Date {
  return new Date(s + "T00:00:00");
}

export type Frequency = "weekly" | "biweekly" | "semimonthly" | "monthly" | "custom";

// ---------- Income occurrences ----------
export interface IncomeMeta {
  payday: string;
  frequency: Frequency;
  secondPaydayDay?: number | null;
  customIntervalDays?: number | null;
}

// Backward-compatible signature: positional or meta object
export function incomeOccurrencesInMonth(
  paydayOrMeta: string | IncomeMeta,
  frequency: Frequency,
  year: number,
  month: number,
  secondPaydayDay?: number | null,
  customIntervalDays?: number | null,
): Date[] {
  const meta: IncomeMeta =
    typeof paydayOrMeta === "string"
      ? { payday: paydayOrMeta, frequency, secondPaydayDay: secondPaydayDay ?? null, customIntervalDays: customIntervalDays ?? null }
      : paydayOrMeta;

  const start = parseISODate(meta.payday);
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const out: Date[] = [];

  if (meta.frequency === "monthly") {
    const day = start.getDate();
    const lastDay = monthEnd.getDate();
    const d = new Date(year, month, Math.min(day, lastDay));
    if (d >= start) out.push(d);
    return out;
  }
  if (meta.frequency === "semimonthly") {
    const d1 = start.getDate();
    const lastDay = monthEnd.getDate();
    const a = new Date(year, month, Math.min(d1, lastDay));
    const day2 = meta.secondPaydayDay ?? d1 + 14;
    const b = new Date(year, month, Math.min(day2 <= 0 ? lastDay : day2, lastDay));
    if (a >= start) out.push(a);
    if (b >= start && b.getTime() !== a.getTime()) out.push(b);
    out.sort((x, y) => x.getTime() - y.getTime());
    return out;
  }
  if (meta.frequency === "custom") {
    const step = meta.customIntervalDays && meta.customIntervalDays > 0 ? meta.customIntervalDays : null;
    if (!step) {
      // no interval → treat the start date itself as a one-off in its own month
      if (start >= monthStart && start <= monthEnd) out.push(start);
      return out;
    }
    const cursor = new Date(start);
    while (cursor < monthStart) cursor.setDate(cursor.getDate() + step);
    while (cursor <= monthEnd) {
      out.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + step);
    }
    return out;
  }
  // weekly / biweekly
  const stepDays = meta.frequency === "weekly" ? 7 : 14;
  const cursor = new Date(start);
  while (cursor < monthStart) cursor.setDate(cursor.getDate() + stepDays);
  while (cursor <= monthEnd) {
    out.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + stepDays);
  }
  return out;
}

export function futurePaydays(
  paydayOrMeta: string | IncomeMeta,
  frequency: Frequency,
  count: number,
  from: Date = new Date(),
  secondPaydayDay?: number | null,
  customIntervalDays?: number | null,
): Date[] {
  const meta: IncomeMeta =
    typeof paydayOrMeta === "string"
      ? { payday: paydayOrMeta, frequency, secondPaydayDay: secondPaydayDay ?? null, customIntervalDays: customIntervalDays ?? null }
      : paydayOrMeta;

  const start = parseISODate(meta.payday);
  const out: Date[] = [];
  const fromMidnight = new Date(from.getFullYear(), from.getMonth(), from.getDate());

  if (meta.frequency === "weekly" || meta.frequency === "biweekly" || (meta.frequency === "custom" && meta.customIntervalDays && meta.customIntervalDays > 0)) {
    const step = meta.frequency === "weekly" ? 7 : meta.frequency === "biweekly" ? 14 : meta.customIntervalDays!;
    const cursor = new Date(start);
    if (cursor < fromMidnight) {
      const diffDays = Math.floor((fromMidnight.getTime() - cursor.getTime()) / 86400000);
      const jumps = Math.ceil(diffDays / step);
      cursor.setDate(cursor.getDate() + jumps * step);
    }
    while (out.length < count) {
      out.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + step);
    }
    return out;
  }

  if (meta.frequency === "semimonthly") {
    const day1 = start.getDate();
    const day2raw = meta.secondPaydayDay ?? day1 + 14;
    let y = fromMidnight.getFullYear();
    let m = fromMidnight.getMonth();
    while (out.length < count) {
      const lastDay = new Date(y, m + 1, 0).getDate();
      const a = new Date(y, m, Math.min(day1, lastDay));
      const b = new Date(y, m, Math.min(day2raw <= 0 ? lastDay : day2raw, lastDay));
      const pair = [a, b].filter((d, i, arr) => i === arr.findIndex(x => x.getTime() === d.getTime()))
        .sort((x, y) => x.getTime() - y.getTime());
      for (const d of pair) {
        if (d >= fromMidnight && d >= start && out.length < count) out.push(d);
      }
      m++;
      if (m > 11) { m = 0; y++; }
    }
    return out;
  }

  // monthly OR custom with no interval (one-off) — once per month on payday's day
  const day = start.getDate();
  let y = fromMidnight.getFullYear();
  let m = fromMidnight.getMonth();
  while (out.length < count) {
    const lastDay = new Date(y, m + 1, 0).getDate();
    const d = new Date(y, m, Math.min(day, lastDay));
    if (d >= fromMidnight && d >= start) out.push(d);
    m++;
    if (m > 11) { m = 0; y++; }
    if (m > fromMidnight.getMonth() + 240) break; // safety
  }
  return out;
}

// ============= PAYOFF ENGINE =============
export interface CardSim {
  id: string;
  name: string;
  balance: number;
  apr: number;
  minimum_payment: number;
  priority?: number;
}

export interface PayoffWarning {
  cardId: string;
  cardName: string;
  type: "min_below_interest" | "balance_growing" | "infeasible";
  message: string;
}

export interface MonthSchedule {
  month: number;
  totalPaid: number;
  totalInterest: number;
  remaining: number;
  perCard: Record<string, { interest: number; payment: number; balance: number }>;
}

export interface PayoffResult {
  months: number;
  totalInterest: number;
  totalPaid: number;
  payoffDate: Date;
  perCard: Record<string, { months: number; interest: number; payoffDate: Date }>;
  schedule: MonthSchedule[];
  recommendedTargetId: string | null;
  warnings: PayoffWarning[];
  feasible: boolean;
}

export type Strategy = "snowball" | "avalanche" | "custom";

function orderCards(cards: CardSim[], strategy: Strategy): string[] {
  if (strategy === "snowball") return [...cards].sort((a, b) => a.balance - b.balance).map(c => c.id);
  if (strategy === "avalanche") return [...cards].sort((a, b) => b.apr - a.apr).map(c => c.id);
  // custom — by priority asc, fall back to insertion order
  return [...cards].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0)).map(c => c.id);
}

export function simulatePayoff(
  cards: CardSim[],
  strategy: Strategy,
  extraMonthly: number,
): PayoffResult {
  const list = cards.map(c => ({ ...c }));
  const order = orderCards(list, strategy);
  const map = new Map(list.map(c => [c.id, c]));
  const originalMin = new Map(list.map(c => [c.id, c.minimum_payment]));

  const perCard: Record<string, { months: number; interest: number; payoffDate: Date }> = {};
  list.forEach(c => (perCard[c.id] = { months: 0, interest: 0, payoffDate: new Date() }));

  const warnings: PayoffWarning[] = [];
  const schedule: MonthSchedule[] = [];

  // pre-flight: check if min < monthly interest on any card
  for (const c of list) {
    const monthlyInterest = c.balance * (c.apr / 100 / 12);
    if (c.balance > 0 && c.minimum_payment > 0 && c.minimum_payment <= monthlyInterest) {
      warnings.push({
        cardId: c.id, cardName: c.name, type: "min_below_interest",
        message: `Minimum (${fmtMoney(c.minimum_payment)}) doesn't cover monthly interest (${fmtMoney(monthlyInterest)}).`,
      });
    }
  }

  let months = 0;
  let totalInterest = 0;
  let totalPaid = 0;
  let prevTotalBalance = list.reduce((s, c) => s + Math.max(0, c.balance), 0);
  const start = new Date();

  while (Array.from(map.values()).some(c => c.balance > 0.01)) {
    months++;
    if (months > 600) {
      // infeasible
      for (const c of map.values()) {
        if (c.balance > 0.01) {
          warnings.push({
            cardId: c.id, cardName: c.name, type: "infeasible",
            message: `${c.name} cannot be paid off — balance is growing or stuck.`,
          });
        }
      }
      return {
        months, totalInterest, totalPaid,
        payoffDate: addMonths(start, months),
        perCard, schedule, recommendedTargetId: order[0] ?? null,
        warnings, feasible: false,
      };
    }

    let extra = extraMonthly;
    // Roll over freed minimum payments into available extra
    for (const c of list) {
      const cur = map.get(c.id)!;
      if (cur.balance <= 0) {
        extra += originalMin.get(c.id) ?? 0;
      }
    }

    const monthEntry: MonthSchedule = {
      month: months, totalPaid: 0, totalInterest: 0, remaining: 0,
      perCard: {},
    };

    // Apply interest + minimums
    for (const c of map.values()) {
      const monthlyRate = c.apr / 100 / 12;
      const interest = c.balance > 0 ? c.balance * monthlyRate : 0;
      c.balance += interest;
      totalInterest += interest;
      perCard[c.id].interest += interest;

      const minPay = c.balance > 0 ? Math.min(c.minimum_payment, c.balance) : 0;
      c.balance = Math.max(0, c.balance - minPay);
      totalPaid += minPay;
      // subtract the rolled-extra portion: we already added originalMin for paid-off cards above to `extra`
      // actual minPay is what comes off this month for this card
      monthEntry.perCard[c.id] = { interest, payment: minPay, balance: c.balance };
    }

    // Apply extra to highest-priority unpaid card(s) in order
    for (const id of order) {
      if (extra <= 0) break;
      const c = map.get(id);
      if (!c || c.balance <= 0) continue;
      const pay = Math.min(extra, c.balance);
      c.balance = Math.max(0, c.balance - pay);
      totalPaid += pay;
      extra -= pay;
      monthEntry.perCard[c.id].payment += pay;
      monthEntry.perCard[c.id].balance = c.balance;
    }

    // Track payoff month per card
    for (const id of order) {
      const c = map.get(id);
      if (c && c.balance > 0) perCard[id].months = months;
      else if (c && c.balance <= 0 && perCard[id].months === 0) {
        perCard[id].months = months;
        perCard[id].payoffDate = addMonths(start, months);
      }
    }

    monthEntry.totalPaid = Object.values(monthEntry.perCard).reduce((s, x) => s + x.payment, 0);
    monthEntry.totalInterest = Object.values(monthEntry.perCard).reduce((s, x) => s + x.interest, 0);
    monthEntry.remaining = Array.from(map.values()).reduce((s, c) => s + Math.max(0, c.balance), 0);
    schedule.push(monthEntry);

    // Detect growing balance after a few months
    if (months === 6 && monthEntry.remaining > prevTotalBalance) {
      for (const c of map.values()) {
        if (c.balance > 0) {
          warnings.push({
            cardId: c.id, cardName: c.name, type: "balance_growing",
            message: `Balance is growing — increase your payments.`,
          });
        }
      }
    }
    prevTotalBalance = Math.min(prevTotalBalance, monthEntry.remaining);
  }

  // finalize payoff dates for any not yet set
  for (const c of list) {
    if (perCard[c.id].months === 0 && c.balance <= 0) {
      perCard[c.id].months = months;
    }
    perCard[c.id].payoffDate = addMonths(start, perCard[c.id].months);
  }

  const recommended = order.find(id => list.find(c => c.id === id && c.balance > 0)) ?? order[0] ?? null;

  return {
    months, totalInterest, totalPaid,
    payoffDate: addMonths(start, months),
    perCard, schedule, recommendedTargetId: recommended,
    warnings, feasible: true,
  };
}

export function estimateMonthlyInterest(balance: number, apr: number): number {
  return Math.max(0, balance) * (apr / 100 / 12);
}
