import { useState, useMemo, useEffect } from "react";
import { useIncome, useUpsertIncome, useDeleteIncome, type IncomeSource } from "@/lib/data";
import { fmtMoney, incomeOccurrencesInMonth, futurePaydays, todayISO } from "@/lib/finance";
import { PageHeader, EmptyState } from "@/components/ui-bits";
import { ConfirmDelete } from "@/components/confirm-delete";
import { downloadCSV } from "@/lib/export-csv";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, CalendarDays, Download } from "lucide-react";
import { toast } from "sonner";

const FREQS = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly (every 2 weeks)" },
  { value: "semimonthly", label: "Twice monthly (e.g. 1st & 15th)" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom interval" },
] as const;

export function IncomePage() {
  const { data = [], isLoading } = useIncome();
  const upsert = useUpsertIncome();
  const del = useDeleteIncome();
  const [editing, setEditing] = useState<IncomeSource | null>(null);
  const [open, setOpen] = useState(false);

  const now = new Date();
  const totalMonth = data.reduce((s, i) => {
    const occ = incomeOccurrencesInMonth(
      { payday: i.payday_date, frequency: i.frequency, secondPaydayDay: i.second_payday_day, customIntervalDays: i.custom_interval_days },
      i.frequency, now.getFullYear(), now.getMonth(),
    );
    return s + i.amount * occ.length;
  }, 0);

  const allPaydays = data
    .flatMap(i =>
      incomeOccurrencesInMonth(
        { payday: i.payday_date, frequency: i.frequency, secondPaydayDay: i.second_payday_day, customIntervalDays: i.custom_interval_days },
        i.frequency, now.getFullYear(), now.getMonth(),
      ).map(d => ({ name: i.name, amount: i.amount, date: d })),
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const [horizon, setHorizon] = useState<"3" | "6" | "12">("6");
  const future = useMemo(() => {
    const months = Number(horizon);
    const perSource = Math.ceil((months * 31) / 7) + 2;
    const cutoff = new Date(now.getFullYear(), now.getMonth() + months, now.getDate());
    const all = data.flatMap(i =>
      futurePaydays(
        { payday: i.payday_date, frequency: i.frequency, secondPaydayDay: i.second_payday_day, customIntervalDays: i.custom_interval_days },
        i.frequency, perSource, now,
      )
        .filter(d => d <= cutoff)
        .map(d => ({ name: i.name, amount: i.amount, date: d, frequency: i.frequency })),
    );
    all.sort((a, b) => a.date.getTime() - b.date.getTime());
    const groups = new Map<string, { label: string; total: number; items: typeof all }>();
    for (const p of all) {
      const key = `${p.date.getFullYear()}-${p.date.getMonth()}`;
      const label = p.date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      const g = groups.get(key) ?? { label, total: 0, items: [] };
      g.total += p.amount;
      g.items.push(p);
      groups.set(key, g);
    }
    const total = all.reduce((s, p) => s + p.amount, 0);
    return { groups: Array.from(groups.values()), total, count: all.length, all };
  }, [data, horizon, now]);

  const onAdd = () => { setEditing(null); setOpen(true); };
  const handleExport = () => {
    downloadCSV("paychecks-projection.csv", future.all.map(p => ({
      date: p.date.toISOString().slice(0, 10),
      day_of_week: p.date.toLocaleDateString("en-US", { weekday: "long" }),
      source: p.name, amount: p.amount, frequency: p.frequency,
    })));
  };

  return (
    <div>
      <PageHeader
        title="Income"
        description={`Total this month: ${fmtMoney(totalMonth)}`}
        action={
          <div className="flex gap-2">
            {data.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="size-4 mr-1" />Export
              </Button>
            )}
            <Button onClick={onAdd}><Plus className="size-4 mr-1" />Add income</Button>
          </div>
        }
      />

      <IncomeDialog
        open={open} onOpenChange={setOpen} editing={editing}
        onSubmit={async row => { await upsert.mutateAsync(row); setOpen(false); toast.success(editing ? "Updated" : "Added"); }}
      />

      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>
      ) : data.length === 0 ? (
        <EmptyState
          title="No income sources yet"
          description="Add salaries, side hustles, or recurring payouts to see your real monthly income."
          action={<Button onClick={onAdd}><Plus className="size-4 mr-1" />Add your first income</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <h3 className="font-semibold mb-3">Sources</h3>
            <ul className="space-y-2">
              {data.map(i => (
                <li key={i.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{i.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {freqLabel(i)} · starts {new Date(i.payday_date + "T00:00:00").toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="font-semibold text-success">{fmtMoney(i.amount)}</div>
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(i); setOpen(true); }}>
                      <Pencil className="size-4" />
                    </Button>
                    <ConfirmDelete
                      title={`Delete "${i.name}"?`}
                      description="This income source will be removed from projections."
                      onConfirm={() => del.mutateAsync(i.id)}
                      trigger={<Button variant="ghost" size="icon"><Trash2 className="size-4 text-destructive" /></Button>}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold mb-3">Paydays this month</h3>
            {allPaydays.length === 0 ? (
              <p className="text-sm text-muted-foreground">No paydays in this month.</p>
            ) : (
              <ul className="space-y-2">
                {allPaydays.map((p, i) => (
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
                    <div className="font-semibold text-success">+{fmtMoney(p.amount)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {data.length > 0 && (
        <Card className="p-5 mt-4">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <CalendarDays className="size-4 text-info" /> Future paychecks
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Projected from your pay schedule. {future.count} paychecks · {fmtMoney(future.total)} total
              </p>
            </div>
            <Select value={horizon} onValueChange={v => setHorizon(v as "3" | "6" | "12")}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Next 3 months</SelectItem>
                <SelectItem value="6">Next 6 months</SelectItem>
                <SelectItem value="12">Next 12 months</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {future.groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming paychecks in this window.</p>
          ) : (
            <div className="space-y-5">
              {future.groups.map(g => (
                <div key={g.label}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">{g.label}</div>
                    <div className="text-sm font-semibold text-success">{fmtMoney(g.total)}</div>
                  </div>
                  <ul className="space-y-1">
                    {g.items.map((p, idx) => (
                      <li key={idx} className="flex items-center justify-between py-2 px-3 rounded-md bg-accent/40 border border-border">
                        <div className="flex items-center gap-3">
                          <div className="text-xs font-mono w-12 text-muted-foreground">
                            {p.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </div>
                          <div>
                            <div className="text-sm font-medium">{p.name}</div>
                            <div className="text-xs text-muted-foreground">{p.date.toLocaleDateString("en-US", { weekday: "long" })}</div>
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-success">+{fmtMoney(p.amount)}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function freqLabel(i: IncomeSource): string {
  if (i.frequency === "semimonthly") {
    const d1 = new Date(i.payday_date + "T00:00:00").getDate();
    const d2 = i.second_payday_day ?? d1 + 14;
    return `Twice monthly (day ${d1} & ${d2})`;
  }
  if (i.frequency === "custom") return `Every ${i.custom_interval_days ?? "?"} days`;
  return i.frequency.charAt(0).toUpperCase() + i.frequency.slice(1);
}

function IncomeDialog({
  open, onOpenChange, editing, onSubmit,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: IncomeSource | null;
  onSubmit: (row: Partial<IncomeSource> & { id?: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [payday, setPayday] = useState(todayISO());
  const [frequency, setFrequency] = useState<IncomeSource["frequency"]>("biweekly");
  const [secondDay, setSecondDay] = useState<string>("");
  const [intervalDays, setIntervalDays] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setAmount(editing ? String(editing.amount) : "");
    setPayday(editing?.payday_date ?? todayISO());
    setFrequency(editing?.frequency ?? "biweekly");
    setSecondDay(editing?.second_payday_day ? String(editing.second_payday_day) : "");
    setIntervalDays(editing?.custom_interval_days ? String(editing.custom_interval_days) : "");
  }, [open, editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name is required");
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter a valid amount");
    if (frequency === "custom") {
      const days = Number(intervalDays);
      if (!Number.isInteger(days) || days < 1) return toast.error("Custom interval must be a positive number of days");
    }
    if (frequency === "semimonthly" && secondDay) {
      const d2 = Number(secondDay);
      if (!Number.isInteger(d2) || d2 < 1 || d2 > 31) return toast.error("Second payday must be 1–31");
    }
    await onSubmit({
      id: editing?.id,
      name: name.trim(),
      amount: amt,
      payday_date: payday,
      frequency,
      second_payday_day: frequency === "semimonthly" && secondDay ? Number(secondDay) : null,
      custom_interval_days: frequency === "custom" ? Number(intervalDays) : null,
    });
  };

  const startDay = new Date(payday + "T00:00:00").getDate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit income" : "Add income"}</DialogTitle>
          <DialogDescription>Set how often you get paid so projections stay accurate.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Day job" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Amount per payday</Label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{frequency === "semimonthly" ? "First payday" : "Most recent payday"}</Label>
              <Input type="date" value={payday} onChange={e => setPayday(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select value={frequency} onValueChange={v => setFrequency(v as IncomeSource["frequency"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FREQS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {frequency === "semimonthly" && (
            <div className="space-y-2">
              <Label>Second payday (day of month)</Label>
              <Input type="number" min="1" max="31" placeholder={String(startDay + 14)} value={secondDay} onChange={e => setSecondDay(e.target.value)} />
              <p className="text-xs text-muted-foreground">First day = {startDay}. Common: 1 & 15, or 15 & last day.</p>
            </div>
          )}
          {frequency === "custom" && (
            <div className="space-y-2">
              <Label>Days between paychecks</Label>
              <Input type="number" min="1" placeholder="e.g. 10" value={intervalDays} onChange={e => setIntervalDays(e.target.value)} />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{editing ? "Save" : "Add"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
