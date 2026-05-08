import { useMemo } from "react";
import { useIncome, useBills, useCards, useSavings, useSettings, useBillPayments } from "@/lib/data";
import { fmtMoney, incomeOccurrencesInMonth, simulatePayoff, addMonths } from "@/lib/finance";
import { PageHeader, StatCard } from "@/components/ui-bits";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Wallet, Receipt, CreditCard, PiggyBank, TrendingDown, CalendarDays } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function Dashboard() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const periodMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const income = useIncome();
  const bills = useBills();
  const cards = useCards();
  const savings = useSavings();
  const settings = useSettings();
  const payments = useBillPayments(periodMonth);

  const empty =
    !income.isLoading &&
    !bills.isLoading &&
    !cards.isLoading &&
    (income.data?.length ?? 0) === 0 &&
    (bills.data?.length ?? 0) === 0 &&
    (cards.data?.length ?? 0) === 0;

  const totals = useMemo(() => {
    const occByIncome = (income.data ?? []).map(i => ({
      income: i,
      occ: incomeOccurrencesInMonth(i.payday_date, i.frequency, year, month),
    }));
    const totalIncome = occByIncome.reduce((s, x) => s + x.income.amount * x.occ.length, 0);
    const totalBills = (bills.data ?? []).reduce((s, b) => s + b.amount, 0);
    const totalDebt = (cards.data ?? []).reduce((s, c) => s + c.balance, 0);
    const totalLimit = (cards.data ?? []).reduce((s, c) => s + c.credit_limit, 0);
    const totalMin = (cards.data ?? []).reduce((s, c) => s + c.minimum_payment, 0);
    const totalSavings = (savings.data ?? []).reduce((s, a) => s + a.balance, 0);
    const utilization = totalLimit > 0 ? (totalDebt / totalLimit) * 100 : 0;
    const remaining = totalIncome - totalBills - totalMin;
    const paidIds = new Set((payments.data ?? []).map(p => p.bill_id));
    const upcoming = (bills.data ?? [])
      .map(b => ({ ...b, paid: paidIds.has(b.id) }))
      .filter(b => !b.paid)
      .sort((a, b) => a.due_day - b.due_day);
    const paydayList = occByIncome.flatMap(x =>
      x.occ.map(d => ({ name: x.income.name, amount: x.income.amount, date: d })),
    );
    paydayList.sort((a, b) => a.date.getTime() - b.date.getTime());
    return {
      totalIncome,
      totalBills,
      totalDebt,
      totalLimit,
      totalMin,
      totalSavings,
      utilization,
      remaining,
      upcoming: upcoming.slice(0, 5),
      paydayList: paydayList.filter(p => p.date >= new Date(year, month, now.getDate())).slice(0, 5),
    };
  }, [income.data, bills.data, cards.data, savings.data, payments.data, year, month, now]);

  const sim = useMemo(() => {
    const list = (cards.data ?? []).map(c => ({
      id: c.id,
      name: c.name,
      balance: c.balance,
      apr: c.apr,
      minimum_payment: c.minimum_payment,
    }));
    if (list.length === 0) return null;
    const strategy = settings.data?.payoff_strategy ?? "avalanche";
    const extra = settings.data?.extra_monthly_payment ?? 0;
    const baseline = simulatePayoff(list, strategy, 0);
    const withExtra = simulatePayoff(list, strategy, extra);
    const saved = baseline.totalInterest - withExtra.totalInterest;
    const payoffDate = addMonths(new Date(), withExtra.months);
    const suggestedFirst = (() => {
      if (strategy === "snowball") return [...list].sort((a, b) => a.balance - b.balance)[0];
      if (strategy === "avalanche") return [...list].sort((a, b) => b.apr - a.apr)[0];
      return list[0];
    })();
    return { baseline, withExtra, saved, payoffDate, suggestedFirst, strategy };
  }, [cards.data, settings.data]);

  if (empty) {
    return (
      <div>
        <PageHeader title="Welcome to Ledger" description="Set up your money picture in a few steps." />
        <div className="grid gap-4 md:grid-cols-3">
          <SetupCard to="/income" icon={<Wallet className="size-5" />} title="Add income" desc="Salaries and side hustles." />
          <SetupCard to="/bills" icon={<Receipt className="size-5" />} title="Add bills" desc="Rent, utilities, subscriptions." />
          <SetupCard to="/cards" icon={<CreditCard className="size-5" />} title="Add credit cards" desc="See your payoff plan." />
        </div>
      </div>
    );
  }

  const monthName = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div>
      <PageHeader title="Dashboard" description={monthName} />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Income" value={fmtMoney(totals.totalIncome)} icon={<Wallet className="size-5" />} tone="success" />
        <StatCard label="Bills" value={fmtMoney(totals.totalBills)} icon={<Receipt className="size-5" />} />
        <StatCard
          label="After bills"
          value={fmtMoney(totals.remaining)}
          tone={totals.remaining >= 0 ? "info" : "destructive"}
          hint="Income − bills − min payments"
        />
        <StatCard label="Card debt" value={fmtMoney(totals.totalDebt)} icon={<CreditCard className="size-5" />} tone={totals.totalDebt > 0 ? "destructive" : "default"} />
      </div>

      <div className="grid gap-4 mt-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Upcoming bills</h3>
            <Link to="/bills" className="text-xs text-muted-foreground hover:text-foreground">View all</Link>
          </div>
          {totals.upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">All caught up. Nothing due.</p>
          ) : (
            <ul className="space-y-2">
              {totals.upcoming.map(b => {
                const daysAway = Math.max(0, b.due_day - now.getDate());
                const tone = daysAway === 0 ? "destructive" : daysAway <= 3 ? "warning" : "default";
                return (
                  <li key={b.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <div className="font-medium text-sm">{b.name}</div>
                      <div className="text-xs text-muted-foreground">{b.category} · Due day {b.due_day}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-sm">{fmtMoney(b.amount)}</div>
                      <DueBadge tone={tone} days={daysAway} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Upcoming paydays</h3>
            <Link to="/income" className="text-xs text-muted-foreground hover:text-foreground">View all</Link>
          </div>
          {totals.paydayList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No more paydays this month.</p>
          ) : (
            <ul className="space-y-2">
              {totals.paydayList.map((p, i) => (
                <li key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <CalendarDays className="size-4 text-info" />
                    <div>
                      <div className="font-medium text-sm">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </div>
                    </div>
                  </div>
                  <div className="font-semibold text-sm text-success">+{fmtMoney(p.amount)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 mt-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2"><TrendingDown className="size-4" /> Payoff plan</h3>
            <Link to="/payoff" className="text-xs text-muted-foreground hover:text-foreground">Open planner</Link>
          </div>
          {!sim ? (
            <p className="text-sm text-muted-foreground">Add a credit card to see a payoff plan.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Stat tone="info" label="Payoff date" value={sim.payoffDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })} />
                <Stat tone="success" label="Interest saved" value={fmtMoney(sim.saved)} />
              </div>
              <div className="text-sm">
                Strategy: <Badge variant="secondary" className="ml-1 capitalize">{sim.strategy}</Badge>
              </div>
              {sim.suggestedFirst && (
                <div className="rounded-lg bg-accent p-3 text-sm">
                  Pay extra to <span className="font-semibold">{sim.suggestedFirst.name}</span> first.
                </div>
              )}
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Credit utilization</span>
                  <span>{totals.utilization.toFixed(0)}%</span>
                </div>
                <Progress value={Math.min(100, totals.utilization)} />
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2"><PiggyBank className="size-4" /> Savings</h3>
            <Link to="/savings" className="text-xs text-muted-foreground hover:text-foreground">View all</Link>
          </div>
          {(savings.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No savings buckets yet.</p>
          ) : (
            <div className="space-y-3">
              <div className="text-2xl font-bold tracking-tight text-info">{fmtMoney(totals.totalSavings)}</div>
              {(savings.data ?? []).slice(0, 4).map(s => {
                const pct = s.goal > 0 ? (s.balance / s.goal) * 100 : 0;
                return (
                  <div key={s.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-muted-foreground">{fmtMoney(s.balance)} {s.goal > 0 && `/ ${fmtMoney(s.goal)}`}</span>
                    </div>
                    {s.goal > 0 && <Progress value={Math.min(100, pct)} />}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function SetupCard({ to, icon, title, desc }: { to: "/income" | "/bills" | "/cards"; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Card className="p-6">
      <div className="size-10 rounded-lg bg-accent grid place-items-center text-accent-foreground mb-3">{icon}</div>
      <div className="font-semibold">{title}</div>
      <p className="text-sm text-muted-foreground mt-1 mb-4">{desc}</p>
      <Button asChild size="sm"><Link to={to}>Get started</Link></Button>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "success" | "info" | "warning" | "destructive" }) {
  const c = { success: "text-success", info: "text-info", warning: "text-warning", destructive: "text-destructive" }[tone];
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${c}`}>{value}</div>
    </div>
  );
}

function DueBadge({ tone, days }: { tone: "default" | "warning" | "destructive"; days: number }) {
  const text = days === 0 ? "Due today" : days <= 3 ? `In ${days}d` : `Day ${days + new Date().getDate()}`;
  const cls = tone === "destructive" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-muted-foreground";
  return <div className={`text-xs ${cls}`}>{text}</div>;
}
