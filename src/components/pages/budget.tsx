import { useEffect, useMemo, useState } from "react";
import {
  useIncome, useBills, useCards, useSavings, useSettings,
  useMonthlyBudget, useUpsertMonthlyBudget, useOneTimeExpenses,
} from "@/lib/data";
import { fmtMoney, incomeOccurrencesInMonth, monthKey } from "@/lib/finance";
import { PageHeader, StatCard, EmptyState } from "@/components/ui-bits";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Wallet, Receipt, CreditCard, PiggyBank, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Save, ShoppingCart, Fuel, ShoppingBag } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export function BudgetPage() {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const monthName = new Date(cursor.year, cursor.month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const monthIso = monthKey(cursor.year, cursor.month);

  const income = useIncome();
  const bills = useBills();
  const cards = useCards();
  const savings = useSavings();
  const settings = useSettings();
  const oneTime = useOneTimeExpenses();
  const { data: mbs } = useMonthlyBudget(monthIso);
  const upsertBudget = useUpsertMonthlyBudget();

  // local editable copy of monthly settings
  const [grocery, setGrocery] = useState("");
  const [gas, setGas] = useState("");
  const [other, setOther] = useState("");
  const [extraDebt, setExtraDebt] = useState("");
  const [safeMin, setSafeMin] = useState("");

  useEffect(() => {
    setGrocery(String(mbs?.grocery_budget ?? 0));
    setGas(String(mbs?.gas_budget ?? 0));
    setOther(String(mbs?.other_budget ?? 0));
    setExtraDebt(String(mbs?.extra_debt_payment ?? settings.data?.extra_monthly_payment ?? 0));
    setSafeMin(String(mbs?.safe_minimum_balance ?? settings.data?.safe_minimum_balance ?? 0));
  }, [mbs, settings.data, monthIso]);

  const isLoading = income.isLoading || bills.isLoading || cards.isLoading;

  const data = useMemo(() => {
    const incomeRows = (income.data ?? []).map(i => {
      const occ = incomeOccurrencesInMonth(
        { payday: i.payday_date, frequency: i.frequency, secondPaydayDay: i.second_payday_day, customIntervalDays: i.custom_interval_days },
        i.frequency, cursor.year, cursor.month,
      );
      return { ...i, occurrences: occ.length, monthly: i.amount * occ.length };
    });
    const totalIncome = incomeRows.reduce((s, r) => s + r.monthly, 0);

    const billsByCat = new Map<string, { total: number; items: typeof bills.data }>();
    for (const b of bills.data ?? []) {
      const g = billsByCat.get(b.category) ?? { total: 0, items: [] };
      g.total += b.amount;
      g.items!.push(b);
      billsByCat.set(b.category, g);
    }
    const billCategories = Array.from(billsByCat.entries())
      .map(([cat, g]) => ({ category: cat, total: g.total, items: g.items ?? [] }))
      .sort((a, b) => b.total - a.total);
    const totalBills = billCategories.reduce((s, c) => s + c.total, 0);

    const totalMin = (cards.data ?? []).reduce((s, c) => s + c.minimum_payment, 0);
    const extra = Number(extraDebt) || 0;
    const safe = Number(safeMin) || 0;
    const groceryN = Number(grocery) || 0;
    const gasN = Number(gas) || 0;
    const otherN = Number(other) || 0;
    const variable = groceryN + gasN + otherN;

    // one-time expenses for this month
    const oneTimeMonth = (oneTime.data ?? []).filter(e => {
      const d = new Date(e.expense_date + "T00:00:00");
      return d.getFullYear() === cursor.year && d.getMonth() === cursor.month;
    });
    const oneTimeTotal = oneTimeMonth.reduce((s, e) => s + e.amount, 0);

    const remainingAfterBills = totalIncome - totalBills - oneTimeTotal;
    const remainingAfterDebt = remainingAfterBills - totalMin - extra;
    const afterVariable = remainingAfterDebt - variable;
    const free = afterVariable - safe;

    const pct = (n: number) => (totalIncome > 0 ? (n / totalIncome) * 100 : 0);

    return {
      incomeRows, totalIncome, billCategories, totalBills, totalMin,
      extra, safe, groceryN, gasN, otherN, variable,
      oneTimeMonth, oneTimeTotal,
      remainingAfterBills, remainingAfterDebt, afterVariable, free, pct,
    };
  }, [income.data, bills.data, cards.data, oneTime.data, cursor, extraDebt, safeMin, grocery, gas, other]);

  const saveBudget = async () => {
    await upsertBudget.mutateAsync({
      month: monthIso,
      grocery_budget: Number(grocery) || 0,
      gas_budget: Number(gas) || 0,
      other_budget: Number(other) || 0,
      extra_debt_payment: Number(extraDebt) || 0,
      safe_minimum_balance: Number(safeMin) || 0,
    });
    toast.success("Budget saved");
  };

  const goPrev = () => setCursor(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 });
  const goNext = () => setCursor(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 });
  const goToday = () => setCursor({ year: today.getFullYear(), month: today.getMonth() });

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Budget" description={monthName} />
        <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>
      </div>
    );
  }

  if ((income.data?.length ?? 0) === 0 && (bills.data?.length ?? 0) === 0) {
    return (
      <div>
        <PageHeader title="Budget" description={monthName} />
        <EmptyState
          title="Nothing to budget yet"
          description="Add income and bills to see your full monthly budget breakdown."
          action={<Button asChild><Link to="/income">Add income</Link></Button>}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Budget"
        description={monthName}
        action={
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={goPrev}><ChevronLeft className="size-4" /></Button>
            <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
            <Button variant="outline" size="icon" onClick={goNext}><ChevronRight className="size-4" /></Button>
          </div>
        }
      />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Income" value={fmtMoney(data.totalIncome)} icon={<Wallet className="size-5" />} tone="success" />
        <StatCard label="Bills" value={fmtMoney(data.totalBills)} hint={`${data.pct(data.totalBills).toFixed(0)}% of income`} icon={<Receipt className="size-5" />} />
        <StatCard label="Debt payments" value={fmtMoney(data.totalMin + data.extra)} hint={data.extra > 0 ? `Includes ${fmtMoney(data.extra)} extra` : "Minimums only"} icon={<CreditCard className="size-5" />} />
        <StatCard
          label="Free to allocate"
          value={fmtMoney(data.free)}
          hint={data.safe > 0 ? `After ${fmtMoney(data.safe)} buffer` : undefined}
          tone={data.free >= 0 ? "info" : "destructive"}
          icon={data.free >= 0 ? <TrendingUp className="size-5" /> : <TrendingDown className="size-5" />}
        />
      </div>

      {data.free < 0 && (
        <Card className="p-4 mt-4 border-destructive/40 bg-destructive/10">
          <div className="text-sm font-semibold text-destructive">Shortfall: {fmtMoney(Math.abs(data.free))}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Reduce variable budgets or extra debt payment, or add income to balance the month.
          </p>
        </Card>
      )}

      {/* Variable budget editor */}
      <Card className="p-5 mt-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="font-semibold">Variable budget for {monthName}</h3>
            <p className="text-xs text-muted-foreground mt-1">Plan groceries, gas, and other spending. Saved per month.</p>
          </div>
          <Button size="sm" onClick={saveBudget}><Save className="size-4 mr-1" />Save</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <BudgetField label="Groceries" icon={<ShoppingCart className="size-4 text-success" />} value={grocery} onChange={setGrocery} />
          <BudgetField label="Gas" icon={<Fuel className="size-4 text-warning" />} value={gas} onChange={setGas} />
          <BudgetField label="Other" icon={<ShoppingBag className="size-4 text-info" />} value={other} onChange={setOther} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 mt-3">
          <BudgetField label="Extra debt payment" value={extraDebt} onChange={setExtraDebt} />
          <BudgetField label="Safety buffer" value={safeMin} onChange={setSafeMin} />
        </div>
      </Card>

      {/* Cashflow waterfall */}
      <Card className="p-5 mt-4">
        <h3 className="font-semibold mb-4">Where the money goes</h3>
        <div className="space-y-3">
          <Row label="Monthly income" value={data.totalIncome} tone="success" />
          <Row label="− Bills" value={-data.totalBills} pct={data.pct(data.totalBills)} />
          {data.oneTimeTotal > 0 && (
            <Row label="− One-time expenses" value={-data.oneTimeTotal} pct={data.pct(data.oneTimeTotal)} />
          )}
          <Row label="= After bills" value={data.remainingAfterBills} tone={data.remainingAfterBills >= 0 ? "default" : "destructive"} divider />
          <Row label="− Card minimums" value={-data.totalMin} pct={data.pct(data.totalMin)} />
          {data.extra > 0 && <Row label="− Extra debt payment" value={-data.extra} pct={data.pct(data.extra)} />}
          <Row label="= After debt" value={data.remainingAfterDebt} tone={data.remainingAfterDebt >= 0 ? "default" : "destructive"} divider />
          {data.variable > 0 && <Row label="− Variable budget" value={-data.variable} pct={data.pct(data.variable)} />}
          {data.safe > 0 && <Row label="− Safety buffer" value={-data.safe} />}
          <Row label="= Free to save / spend" value={data.free} tone={data.free >= 0 ? "success" : "destructive"} divider />
        </div>
      </Card>

      <div className="grid gap-4 mt-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2"><Wallet className="size-4 text-success" /> Income sources</h3>
            <Link to="/income" className="text-xs text-muted-foreground hover:text-foreground">Manage</Link>
          </div>
          {data.incomeRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No income sources.</p>
          ) : (
            <ul className="space-y-3">
              {data.incomeRows.map(r => (
                <li key={r.id}>
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{r.frequency.replace("semi", "twice ")} · {r.occurrences}× this month</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-success">{fmtMoney(r.monthly)}</div>
                      <div className="text-xs text-muted-foreground">{fmtMoney(r.amount)} / payday</div>
                    </div>
                  </div>
                  <Progress value={data.pct(r.monthly)} className="h-1.5 mt-2" />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2"><Receipt className="size-4" /> Bills by category</h3>
            <Link to="/bills" className="text-xs text-muted-foreground hover:text-foreground">Manage</Link>
          </div>
          {data.billCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bills tracked.</p>
          ) : (
            <ul className="space-y-3">
              {data.billCategories.map(c => (
                <li key={c.category}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.category}</span>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{c.items.length}</Badge>
                    </div>
                    <div className="font-semibold">{fmtMoney(c.total)}</div>
                  </div>
                  <Progress value={data.pct(c.total)} className="h-1.5" />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Suggested allocation */}
      <Card className="p-5 mt-4">
        <h3 className="font-semibold mb-1 flex items-center gap-2"><PiggyBank className="size-4 text-info" /> Suggested allocation</h3>
        <p className="text-xs text-muted-foreground mb-4">A simple split of what's left after bills, debt, and budgets.</p>
        {data.afterVariable <= 0 ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
            Your bills, minimums, and budgets use all your income this month. Trim a category or add income.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <Allocation label="Extra debt payoff" percent={50} amount={data.afterVariable * 0.5} tone="destructive" />
            <Allocation label="Savings" percent={30} amount={data.afterVariable * 0.3} tone="info" />
            <Allocation label="Lifestyle / fun" percent={20} amount={data.afterVariable * 0.2} tone="success" />
          </div>
        )}
      </Card>
    </div>
  );
}

function BudgetField({ label, value, onChange, icon }: { label: string; value: string; onChange: (v: string) => void; icon?: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs">{icon}{label}</Label>
      <Input type="number" min="0" step="10" value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function Row({ label, value, pct, tone = "default", divider = false }: {
  label: string; value: number; pct?: number; tone?: "default" | "success" | "destructive"; divider?: boolean;
}) {
  const toneCls = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "";
  return (
    <div className={divider ? "pt-3 border-t border-border" : ""}>
      <div className="flex items-center justify-between text-sm">
        <span className={divider ? "font-semibold" : ""}>{label}</span>
        <span className={`font-semibold tabular-nums ${toneCls}`}>{fmtMoney(value)}</span>
      </div>
      {pct != null && pct > 0 && (
        <div className="text-[11px] text-muted-foreground mt-0.5">{pct.toFixed(0)}% of income</div>
      )}
    </div>
  );
}

function Allocation({ label, percent, amount, tone }: {
  label: string; percent: number; amount: number; tone: "destructive" | "info" | "success";
}) {
  const c = { destructive: "text-destructive", info: "text-info", success: "text-success" }[tone];
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold ${c}`}>{fmtMoney(amount)}</div>
      <div className="text-[11px] text-muted-foreground mt-1">{percent}% of free cash</div>
    </div>
  );
}

// keep PiggyBank icon used
void PiggyBank;
