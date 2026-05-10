import { useMemo } from "react";
import { useCards, useIncome, useBills, useSavings, useSettings } from "@/lib/data";
import { fmtMoney, incomeOccurrencesInMonth, simulatePayoff, addMonths } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function ReportPage() {
  const { data: cards = [] } = useCards();
  const { data: income = [] } = useIncome();
  const { data: bills = [] } = useBills();
  const { data: savings = [] } = useSavings();
  const { data: settings } = useSettings();

  const now = new Date();
  const monthName = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const totalIncome = useMemo(
    () =>
      income.reduce((s, i) => {
        const occ = incomeOccurrencesInMonth(
          i.payday_date,
          i.frequency,
          now.getFullYear(),
          now.getMonth(),
          i.second_payday_day,
          i.custom_interval_days,
        );
        return s + i.amount * occ.length;
      }, 0),
    [income, now],
  );

  const totalBills = bills.reduce((s, b) => s + b.amount, 0);
  const totalDebt = cards.reduce((s, c) => s + c.balance, 0);
  const totalMin = cards.reduce((s, c) => s + c.minimum_payment, 0);
  const totalSavings = savings.reduce((s, a) => s + a.balance, 0);

  const sim = useMemo(() => {
    if (!cards.length) return null;
    const list = cards.map(c => ({
      id: c.id, name: c.name, balance: c.balance, apr: c.apr, minimum_payment: c.minimum_payment, priority: c.priority,
    }));
    const strategy = settings?.payoff_strategy ?? "avalanche";
    const extra = settings?.extra_monthly_payment ?? 0;
    return {
      strategy,
      extra,
      baseline: simulatePayoff(list, strategy, 0),
      withExtra: simulatePayoff(list, strategy, extra),
    };
  }, [cards, settings]);

  return (
    <div className="print:p-0">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Financial Report</h1>
          <p className="text-sm text-muted-foreground">Print-friendly snapshot for {monthName}</p>
        </div>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" /> Print / Save PDF
        </Button>
      </div>

      <div className="bg-white text-black p-8 rounded-lg print:rounded-none print:shadow-none print:p-0 max-w-4xl mx-auto print:max-w-full space-y-6">
        <header className="border-b pb-3">
          <h1 className="text-3xl font-bold">Financial Snapshot</h1>
          <p className="text-sm">{monthName} · Generated {now.toLocaleDateString()}</p>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Income" value={fmtMoney(totalIncome)} />
          <Stat label="Bills" value={fmtMoney(totalBills)} />
          <Stat label="Card debt" value={fmtMoney(totalDebt)} />
          <Stat label="Savings" value={fmtMoney(totalSavings)} />
        </section>

        <section>
          <h2 className="text-lg font-semibold border-b mb-2">Income sources</h2>
          {income.length === 0 ? <p className="text-sm">No income sources.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b"><th>Name</th><th>Frequency</th><th className="text-right">Amount</th></tr></thead>
              <tbody>
                {income.map(i => (
                  <tr key={i.id} className="border-b"><td className="py-1">{i.name}</td><td className="capitalize">{i.frequency}</td><td className="text-right">{fmtMoney(i.amount)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold border-b mb-2">Bills</h2>
          {bills.length === 0 ? <p className="text-sm">No bills.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b"><th>Name</th><th>Category</th><th>Day</th><th className="text-right">Amount</th></tr></thead>
              <tbody>
                {bills.map(b => (
                  <tr key={b.id} className="border-b"><td className="py-1">{b.name}</td><td>{b.category}</td><td>{b.due_day}</td><td className="text-right">{fmtMoney(b.amount)}</td></tr>
                ))}
                <tr className="font-semibold"><td colSpan={3} className="pt-2">Total</td><td className="text-right pt-2">{fmtMoney(totalBills)}</td></tr>
              </tbody>
            </table>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold border-b mb-2">Credit cards</h2>
          {cards.length === 0 ? <p className="text-sm">No cards.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b"><th>Name</th><th className="text-right">Balance</th><th className="text-right">APR</th><th className="text-right">Min</th></tr></thead>
              <tbody>
                {cards.map(c => (
                  <tr key={c.id} className="border-b">
                    <td className="py-1">{c.name}</td>
                    <td className="text-right">{fmtMoney(c.balance)}</td>
                    <td className="text-right">{c.apr}%</td>
                    <td className="text-right">{fmtMoney(c.minimum_payment)}</td>
                  </tr>
                ))}
                <tr className="font-semibold"><td>Total</td><td className="text-right">{fmtMoney(totalDebt)}</td><td></td><td className="text-right">{fmtMoney(totalMin)}</td></tr>
              </tbody>
            </table>
          )}
        </section>

        {sim && (
          <section>
            <h2 className="text-lg font-semibold border-b mb-2">Payoff plan</h2>
            <p className="text-sm mb-2">
              Strategy: <strong className="capitalize">{sim.strategy}</strong> · Extra payment: <strong>{fmtMoney(sim.extra)} / mo</strong>
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
              <Stat label="Min only" value={`${sim.baseline.months} mo`} />
              <Stat label="With extra" value={`${sim.withExtra.months} mo`} />
              <Stat label="Payoff date" value={addMonths(new Date(), sim.withExtra.months).toLocaleDateString("en-US", { month: "short", year: "numeric" })} />
              <Stat label="Interest saved" value={fmtMoney(sim.baseline.totalInterest - sim.withExtra.totalInterest)} />
            </div>
          </section>
        )}

        <section>
          <h2 className="text-lg font-semibold border-b mb-2">Savings</h2>
          {savings.length === 0 ? <p className="text-sm">No savings buckets.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b"><th>Bucket</th><th className="text-right">Balance</th><th className="text-right">Goal</th></tr></thead>
              <tbody>
                {savings.map(s => (
                  <tr key={s.id} className="border-b"><td className="py-1">{s.name}</td><td className="text-right">{fmtMoney(s.balance)}</td><td className="text-right">{s.goal > 0 ? fmtMoney(s.goal) : "—"}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded p-3">
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}
