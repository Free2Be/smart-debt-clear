import { useMemo } from "react";
import { useCards, useIncome, useBills, useSavings, useSettings } from "@/lib/data";
import { fmtMoney, incomeOccurrencesInMonth, simulatePayoff } from "@/lib/finance";
import { PageHeader, EmptyState } from "@/components/ui-bits";
import { Card } from "@/components/ui/card";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#ec4899", "#14b8a6"];

export function ChartsPage() {
  const { data: cards = [] } = useCards();
  const { data: income = [] } = useIncome();
  const { data: bills = [] } = useBills();
  const { data: savings = [] } = useSavings();
  const { data: settings } = useSettings();

  const now = new Date();

  // Income vs expenses next 6 months
  const monthly = useMemo(() => {
    const arr: { label: string; income: number; bills: number; net: number }[] = [];
    for (let off = 0; off < 6; off++) {
      const d = new Date(now.getFullYear(), now.getMonth() + off, 1);
      const inc = income.reduce((s, i) => {
        const occ = incomeOccurrencesInMonth(i.payday_date, i.frequency, d.getFullYear(), d.getMonth(), i.second_payday_day, i.custom_interval_days);
        return s + i.amount * occ.length;
      }, 0);
      const bil = bills.reduce((s, b) => s + b.amount, 0);
      arr.push({
        label: d.toLocaleDateString("en-US", { month: "short" }),
        income: Math.round(inc),
        bills: Math.round(bil),
        net: Math.round(inc - bil),
      });
    }
    return arr;
  }, [income, bills, now]);

  // Debt projection over time
  const debtProjection = useMemo(() => {
    const list = cards.map(c => ({
      id: c.id, name: c.name, balance: c.balance, apr: c.apr, minimum_payment: c.minimum_payment,
    }));
    if (!list.length) return [];
    const strategy = settings?.payoff_strategy ?? "avalanche";
    const extra = settings?.extra_monthly_payment ?? 0;

    function project(extraAmt: number) {
      const sim = list.map(c => ({ ...c }));
      const order = strategy === "snowball"
        ? [...sim].sort((a, b) => a.balance - b.balance).map(c => c.id)
        : [...sim].sort((a, b) => b.apr - a.apr).map(c => c.id);
      const map = new Map(sim.map(c => [c.id, c]));
      const out: number[] = [Array.from(map.values()).reduce((s, c) => s + c.balance, 0)];
      let m = 0;
      while (Array.from(map.values()).some(c => c.balance > 0.01) && m < 120) {
        m++;
        let ex = extraAmt;
        for (const c of map.values()) {
          if (c.balance <= 0) continue;
          c.balance += c.balance * (c.apr / 100 / 12);
          c.balance -= Math.min(c.minimum_payment, c.balance);
        }
        for (const id of order) {
          if (ex <= 0) break;
          const c = map.get(id)!;
          if (c.balance <= 0) continue;
          const pay = Math.min(ex, c.balance);
          c.balance -= pay;
          ex -= pay;
        }
        out.push(Math.max(0, Array.from(map.values()).reduce((s, c) => s + c.balance, 0)));
      }
      return out;
    }
    const min = project(0);
    const plan = project(extra);
    const len = Math.max(min.length, plan.length);
    const arr: { month: number; minOnly: number; withExtra: number }[] = [];
    for (let i = 0; i < len; i++) {
      arr.push({ month: i, minOnly: Math.round(min[i] ?? 0), withExtra: Math.round(plan[i] ?? 0) });
    }
    return arr;
  }, [cards, settings]);

  const cardBalances = cards.map((c, i) => ({ name: c.name, value: Math.round(c.balance), fill: COLORS[i % COLORS.length] }));
  const savingsBreakdown = savings.map((s, i) => ({ name: s.name, value: Math.round(s.balance), fill: COLORS[i % COLORS.length] }));

  const sim = useMemo(() => {
    const list = cards.map(c => ({ id: c.id, name: c.name, balance: c.balance, apr: c.apr, minimum_payment: c.minimum_payment }));
    if (!list.length) return null;
    const strategy = settings?.payoff_strategy ?? "avalanche";
    const extra = settings?.extra_monthly_payment ?? 0;
    return { baseline: simulatePayoff(list, strategy, 0), withExtra: simulatePayoff(list, strategy, extra) };
  }, [cards, settings]);

  if (!income.length && !bills.length && !cards.length) {
    return (
      <div>
        <PageHeader title="Charts" />
        <EmptyState title="No data yet" description="Add income, bills, or cards to see visual insights." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Charts" description="Visual insights into your money." />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-semibold mb-1">Income vs bills</h3>
          <p className="text-xs text-muted-foreground mb-3">Next 6 months</p>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="income" fill="#22c55e" radius={[6, 6, 0, 0]} />
                <Bar dataKey="bills" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-1">Debt payoff projection</h3>
          <p className="text-xs text-muted-foreground mb-3">
            {sim ? `${sim.withExtra.months} months with extra vs ${sim.baseline.months} minimum only` : "Add credit cards to see projection"}
          </p>
          <div className="h-64">
            {debtProjection.length > 0 ? (
              <ResponsiveContainer>
                <AreaChart data={debtProjection}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={12} label={{ value: "months", position: "insideBottom", offset: -5, fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(v: number) => fmtMoney(v)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Legend />
                  <Area type="monotone" dataKey="minOnly" stroke="#ef4444" fill="url(#g1)" name="Min only" />
                  <Area type="monotone" dataKey="withExtra" stroke="#22c55e" fill="url(#g2)" name="With extra" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid place-items-center h-full text-sm text-muted-foreground">No cards yet.</div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-3">Card balances</h3>
          <div className="h-64">
            {cardBalances.length > 0 ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={cardBalances} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {cardBalances.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtMoney(v)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid place-items-center h-full text-sm text-muted-foreground">No cards yet.</div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-3">Savings progress</h3>
          <div className="h-64">
            {savingsBreakdown.length > 0 ? (
              <ResponsiveContainer>
                <BarChart data={savings.map(s => ({ name: s.name, balance: Math.round(s.balance), goal: Math.round(s.goal) }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={12} width={100} />
                  <Tooltip formatter={(v: number) => fmtMoney(v)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Legend />
                  <Bar dataKey="balance" fill="#06b6d4" radius={[0, 6, 6, 0]} />
                  <Bar dataKey="goal" fill="#a855f7" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid place-items-center h-full text-sm text-muted-foreground">No savings buckets yet.</div>
            )}
          </div>
        </Card>

        <Card className="p-5 md:col-span-2">
          <h3 className="font-semibold mb-3">Net cash each month</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="net" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
