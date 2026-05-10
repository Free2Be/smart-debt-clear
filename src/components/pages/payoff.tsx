import { useMemo, useState } from "react";
import { useCards, useSettings, useUpdateSettings, useUpsertCard } from "@/lib/data";
import { fmtMoney, simulatePayoff, addMonths } from "@/lib/finance";
import { PageHeader, EmptyState, StatCard } from "@/components/ui-bits";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowDown, ArrowUp, AlertTriangle, Download } from "lucide-react";
import { exportCSV } from "@/lib/export-csv";

export function PayoffPage() {
  const { data: cards = [] } = useCards();
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  const upsertCard = useUpsertCard();
  const [whatIf, setWhatIf] = useState<string>("");
  const [showSchedule, setShowSchedule] = useState(false);

  const list = useMemo(
    () =>
      cards.map(c => ({
        id: c.id,
        name: c.name,
        balance: c.balance,
        apr: c.apr,
        minimum_payment: c.minimum_payment,
        priority: c.priority,
      })),
    [cards],
  );

  const strategy = (settings?.payoff_strategy ?? "avalanche") as "snowball" | "avalanche" | "custom";
  const extra = settings?.extra_monthly_payment ?? 0;
  const whatIfNum = whatIf === "" ? extra : Number(whatIf) || 0;

  const baseline = useMemo(() => (list.length ? simulatePayoff(list, strategy, 0) : null), [list, strategy]);
  const planned = useMemo(() => (list.length ? simulatePayoff(list, strategy, extra) : null), [list, strategy, extra]);
  const whatIfSim = useMemo(
    () => (list.length ? simulatePayoff(list, strategy, whatIfNum) : null),
    [list, strategy, whatIfNum],
  );

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
    return [...list].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  })();

  const movePriority = (index: number, dir: -1 | 1) => {
    const target = order[index + dir];
    const cur = order[index];
    if (!target || !cur) return;
    upsertCard.mutate({ id: cur.id, priority: target.priority });
    upsertCard.mutate({ id: target.id, priority: cur.priority });
  };

  const exportSchedule = () => {
    if (!planned) return;
    const rows = planned.schedule.map(m => ({
      month: m.month,
      date: addMonths(new Date(), m.month).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      total_paid: m.totalPaid.toFixed(2),
      total_interest: m.totalInterest.toFixed(2),
      remaining: m.remaining.toFixed(2),
    }));
    exportCSV("payoff-schedule.csv", rows);
  };

  return (
    <div>
      <PageHeader title="Payoff Planner" description="Compare strategies and test extra payments." />

      <Card className="p-5 mb-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Strategy</Label>
            <Select
              value={strategy}
              onValueChange={v => update.mutate({ payoff_strategy: v as "snowball" | "avalanche" | "custom" })}
            >
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
            <Input
              type="number"
              min="0"
              step="10"
              defaultValue={extra}
              onBlur={e => update.mutate({ extra_monthly_payment: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-2">
            <Label>What-if extra (preview only)</Label>
            <Input
              type="number"
              min="0"
              step="10"
              value={whatIf}
              onChange={e => setWhatIf(e.target.value)}
              placeholder={String(extra)}
            />
          </div>
        </div>
      </Card>

      {planned && planned.warnings.length > 0 && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Heads up</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1 text-sm">
              {planned.warnings.map((w, i) => (
                <li key={i}>
                  <strong>{w.cardName}:</strong> {w.message}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-4">
        <StatCard label="Min payments only" value={`${baseline!.months} mo`} hint={fmtMoney(baseline!.totalInterest) + " interest"} />
        <StatCard label="With extra" value={`${planned!.months} mo`} hint={fmtMoney(planned!.totalInterest) + " interest"} tone="info" />
        <StatCard label="Months saved" value={`${baseline!.months - planned!.months} mo`} tone="success" />
        <StatCard label="Interest saved" value={fmtMoney(baseline!.totalInterest - planned!.totalInterest)} tone="success" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Recommended order</h3>
            {strategy === "custom" && <span className="text-xs text-muted-foreground">Use arrows to reorder</span>}
          </div>
          <ol className="space-y-2">
            {order.map((c, i) => (
              <li key={c.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <div className="size-7 rounded-full bg-accent grid place-items-center text-xs font-semibold">{i + 1}</div>
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtMoney(c.balance)} · {c.apr}% APR · min {fmtMoney(c.minimum_payment)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {i === 0 && <div className="text-xs font-medium text-success">Pay extra here</div>}
                  {strategy === "custom" && (
                    <div className="flex flex-col">
                      <Button size="icon" variant="ghost" className="h-6 w-6" disabled={i === 0} onClick={() => movePriority(i, -1)}>
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" disabled={i === order.length - 1} onClick={() => movePriority(i, 1)}>
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-3">What-if scenario</h3>
          <div className="space-y-2 text-sm">
            <Row label="Extra payment" value={fmtMoney(whatIfNum) + " / mo"} />
            <Row label="Payoff in" value={`${whatIfSim!.months} months`} />
            <Row
              label="Payoff date"
              value={addMonths(new Date(), whatIfSim!.months).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
            />
            <Row label="Total interest" value={fmtMoney(whatIfSim!.totalInterest)} />
            <Row label="Saved vs minimum" value={fmtMoney(baseline!.totalInterest - whatIfSim!.totalInterest)} tone="success" />
          </div>
          <Button
            className="mt-4 w-full"
            variant="outline"
            onClick={() => {
              if (whatIf !== "") update.mutate({ extra_monthly_payment: Number(whatIf) || 0 });
            }}
          >
            Save as my plan
          </Button>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h3 className="font-semibold">Month-by-month plan</h3>
            <p className="text-xs text-muted-foreground">
              Using {strategy} with {fmtMoney(extra)} extra / mo
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSchedule(s => !s)}>
              {showSchedule ? "Hide" : "Show"} schedule
            </Button>
            <Button variant="outline" size="sm" onClick={exportSchedule}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </div>
        </div>
        {showSchedule && planned && (
          <div className="overflow-x-auto max-h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Interest</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {planned.schedule.map(m => (
                  <TableRow key={m.month}>
                    <TableCell>{m.month}</TableCell>
                    <TableCell>{addMonths(new Date(), m.month).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</TableCell>
                    <TableCell className="text-right">{fmtMoney(m.totalPaid)}</TableCell>
                    <TableCell className="text-right text-destructive">{fmtMoney(m.totalInterest)}</TableCell>
                    <TableCell className="text-right font-medium">{fmtMoney(m.remaining)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
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
