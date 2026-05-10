import { useMemo } from "react";
import { useIncome, useBills, useCards, useSavings, useSettings } from "@/lib/data";
import { fmtMoney, incomeOccurrencesInMonth } from "@/lib/finance";
import { PageHeader, StatCard, EmptyState } from "@/components/ui-bits";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Wallet, Receipt, CreditCard, PiggyBank, TrendingUp, TrendingDown } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function BudgetPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthName = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const income = useIncome();
  const bills = useBills();
  const cards = useCards();
  const savings = useSavings();
  const settings = useSettings();

  const isLoading = income.isLoading || bills.isLoading || cards.isLoading;

  const data = useMemo(() => {
    const incomeRows = (income.data ?? []).map(i => {
      const occ = incomeOccurrencesInMonth(i.payday_date, i.frequency, year, month);
      return { ...i, occurrences: occ.length, monthly: i.amount * occ.length };
    });
    const totalIncome = incomeRows.reduce((s, r) => s + r.monthly, 0);

    // Bills grouped by category
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
    const extra = settings.data?.extra_monthly_payment ?? 0;
    const safeMin = settings.data?.safe_minimum_balance ?? 0;

    const remainingAfterBills = totalIncome - totalBills;
    const remainingAfterDebt = remainingAfterBills - totalMin - extra;
    const free = remainingAfterDebt - safeMin;

    const pct = (n: number) => (totalIncome > 0 ? (n / totalIncome) * 100 : 0);

    return {
      incomeRows,
      totalIncome,
      billCategories,
      totalBills,
      totalMin,
      extra,
      safeMin,
      remainingAfterBills,
      remainingAfterDebt,
      free,
      pct,
    };
  }, [income.data, bills.data, cards.data, settings.data, year, month]);

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
      <PageHeader title="Budget" description={monthName} />

      {/* Top stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Income"
          value={fmtMoney(data.totalIncome)}
          icon={<Wallet className="size-5" />}
          tone="success"
        />
        <StatCard
          label="Bills"
          value={fmtMoney(data.totalBills)}
          hint={`${data.pct(data.totalBills).toFixed(0)}% of income`}
          icon={<Receipt className="size-5" />}
        />
        <StatCard
          label="Debt payments"
          value={fmtMoney(data.totalMin + data.extra)}
          hint={data.extra > 0 ? `Includes ${fmtMoney(data.extra)} extra` : "Minimums only"}
          icon={<CreditCard className="size-5" />}
        />
        <StatCard
          label="Free to allocate"
          value={fmtMoney(data.free)}
          hint={data.safeMin > 0 ? `After ${fmtMoney(data.safeMin)} buffer` : undefined}
          tone={data.free >= 0 ? "info" : "destructive"}
          icon={data.free >= 0 ? <TrendingUp className="size-5" /> : <TrendingDown className="size-5" />}
        />
      </div>

      {/* Cashflow waterfall */}
      <Card className="p-5 mt-4">
        <h3 className="font-semibold mb-4">Where the money goes</h3>
        <div className="space-y-3">
          <Row label="Monthly income" value={data.totalIncome} tone="success" />
          <Row label="− Bills" value={-data.totalBills} pct={data.pct(data.totalBills)} />
          <Row
            label="= After bills"
            value={data.remainingAfterBills}
            tone={data.remainingAfterBills >= 0 ? "default" : "destructive"}
            divider
          />
          <Row label="− Card minimums" value={-data.totalMin} pct={data.pct(data.totalMin)} />
          {data.extra > 0 && (
            <Row label="− Extra debt payment" value={-data.extra} pct={data.pct(data.extra)} />
          )}
          <Row
            label="= After debt"
            value={data.remainingAfterDebt}
            tone={data.remainingAfterDebt >= 0 ? "default" : "destructive"}
            divider
          />
          {data.safeMin > 0 && <Row label="− Safety buffer" value={-data.safeMin} />}
          <Row
            label="= Free to save / spend"
            value={data.free}
            tone={data.free >= 0 ? "success" : "destructive"}
            divider
          />
        </div>
      </Card>

      <div className="grid gap-4 mt-4 md:grid-cols-2">
        {/* Income breakdown */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Wallet className="size-4 text-success" /> Income sources
            </h3>
            <Link to="/income" className="text-xs text-muted-foreground hover:text-foreground">
              Manage
            </Link>
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
                      <div className="text-xs text-muted-foreground capitalize">
                        {r.frequency.replace("semi", "twice ")} · {r.occurrences}× this month
                      </div>
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

        {/* Bill categories */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Receipt className="size-4" /> Bills by category
            </h3>
            <Link to="/bills" className="text-xs text-muted-foreground hover:text-foreground">
              Manage
            </Link>
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
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                        {c.items.length}
                      </Badge>
                    </div>
                    <div className="font-semibold">{fmtMoney(c.total)}</div>
                  </div>
                  <Progress value={data.pct(c.total)} className="h-1.5" />
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {data.pct(c.total).toFixed(0)}% of income
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Suggested allocation */}
      <Card className="p-5 mt-4">
        <h3 className="font-semibold mb-1 flex items-center gap-2">
          <PiggyBank className="size-4 text-info" /> Suggested allocation
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          A simple split of what's left after bills and debt minimums.
        </p>
        {data.remainingAfterDebt <= 0 ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
            Your bills and minimum payments use all your income this month. Trim a category or add
            income to free up money.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <Allocation
              label="Extra debt payoff"
              percent={50}
              amount={data.remainingAfterDebt * 0.5}
              tone="destructive"
            />
            <Allocation
              label="Savings"
              percent={30}
              amount={data.remainingAfterDebt * 0.3}
              tone="info"
            />
            <Allocation
              label="Lifestyle / fun"
              percent={20}
              amount={data.remainingAfterDebt * 0.2}
              tone="success"
            />
          </div>
        )}
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  pct,
  tone = "default",
  divider = false,
}: {
  label: string;
  value: number;
  pct?: number;
  tone?: "default" | "success" | "destructive";
  divider?: boolean;
}) {
  const toneCls =
    tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "";
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

function Allocation({
  label,
  percent,
  amount,
  tone,
}: {
  label: string;
  percent: number;
  amount: number;
  tone: "destructive" | "info" | "success";
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
