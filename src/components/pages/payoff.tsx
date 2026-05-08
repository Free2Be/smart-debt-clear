import { useMemo, useState } from "react";
import { useCards, useSettings, useUpdateSettings } from "@/lib/data";
import { fmtMoney, simulatePayoff, addMonths } from "@/lib/finance";
import { PageHeader, EmptyState, StatCard } from "@/components/ui-bits";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function PayoffPage() {
  const { data: cards = [] } = useCards();
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  const [whatIf, setWhatIf] = useState<string>("");

  const list = useMemo(() => cards.map(c => ({
    id: c.id, name: c.name, balance: c.balance, apr: c.apr, minimum_payment: c.minimum_payment,
  })), [cards]);

  const strategy = settings?.payoff_strategy ?? "avalanche";
  const extra = settings?.extra_monthly_payment ?? 0;
  const whatIfNum = whatIf === "" ? extra : Number(whatIf) || 0;

  const baseline = useMemo(() => list.length ? simulatePayoff(list, strategy, 0) : null, [list, strategy]);
  const planned = useMemo(() => list.length ? simulatePayoff(list, strategy, extra) : null, [list, strategy, extra]);
  const whatIfSim = useMemo(() => list.length ? simulatePayoff(list, strategy, whatIfNum) : null, [list, strategy, whatIfNum]);

  if (!list.length) {
    return (
      <div>
        <PageHeader title="Payoff Planner" />
        <EmptyState title="Add a credit card first" description="Once you add cards we'll calculate your payoff plan." />
      </div>
    );
  }

  const order = (() => {
    if (strategy === "snowball") return [...list].sort((a, b) => a.balance - b.balance);
    if (strategy === "avalanche") return [...list].sort((a, b) => b.apr - a.apr);
    return list;
  })();

  return (
    <div>
      <PageHeader title="Payoff Planner" description="Compare strategies and test extra payments." />

      <Card className="p-5 mb-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Strategy</Label>
            <Select value={strategy} onValueChange={v => update.mutate({ payoff_strategy: v as "snowball" | "avalanche" | "custom" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="avalanche">Avalanche (highest APR first)</SelectItem>
                <SelectItem value="snowball">Snowball (smallest balance first)</SelectItem>
                <SelectItem value="custom">Custom order</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Extra monthly payment</Label>
            <Input type="number" min="0" step="10" defaultValue={extra}
              onBlur={e => update.mutate({ extra_monthly_payment: Number(e.target.value) || 0 })} />
          </div>
          <div className="space-y-2">
            <Label>What-if extra (preview only)</Label>
            <Input type="number" min="0" step="10" value={whatIf} onChange={e => setWhatIf(e.target.value)} placeholder={String(extra)} />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-4">
        <StatCard label="Min payments only" value={`${baseline!.months} mo`} hint={fmtMoney(baseline!.totalInterest) + " interest"} />
        <StatCard label="With extra" value={`${planned!.months} mo`} hint={fmtMoney(planned!.totalInterest) + " interest"} tone="info" />
        <StatCard label="Months saved" value={`${baseline!.months - planned!.months} mo`} tone="success" />
        <StatCard label="Interest saved" value={fmtMoney(baseline!.totalInterest - planned!.totalInterest)} tone="success" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-semibold mb-3">Recommended order</h3>
          <ol className="space-y-2">
            {order.map((c, i) => (
              <li key={c.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <div className="size-7 rounded-full bg-accent grid place-items-center text-xs font-semibold">{i + 1}</div>
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{fmtMoney(c.balance)} · {c.apr}% APR</div>
                  </div>
                </div>
                {i === 0 && <div className="text-xs font-medium text-success">Pay extra here</div>}
              </li>
            ))}
          </ol>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-3">What-if scenario</h3>
          <div className="space-y-2 text-sm">
            <Row label="Extra payment" value={fmtMoney(whatIfNum) + " / mo"} />
            <Row label="Payoff in" value={`${whatIfSim!.months} months`} />
            <Row label="Payoff date" value={addMonths(new Date(), whatIfSim!.months).toLocaleDateString("en-US", { month: "short", year: "numeric" })} />
            <Row label="Total interest" value={fmtMoney(whatIfSim!.totalInterest)} />
            <Row label="Saved vs minimum" value={fmtMoney(baseline!.totalInterest - whatIfSim!.totalInterest)} tone="success" />
          </div>
          <Button className="mt-4 w-full" variant="outline"
            onClick={() => { if (whatIf !== "") update.mutate({ extra_monthly_payment: Number(whatIf) || 0 }); }}>
            Save as my plan
          </Button>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  return (
    <div className="flex justify-between py-2 border-b border-border last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${tone === "success" ? "text-success" : ""}`}>{value}</span>
    </div>
  );
}
