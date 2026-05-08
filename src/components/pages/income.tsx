import { useState } from "react";
import { useIncome, useUpsertIncome, useDeleteIncome, type IncomeSource } from "@/lib/data";
import { fmtMoney, incomeOccurrencesInMonth } from "@/lib/finance";
import { PageHeader, EmptyState } from "@/components/ui-bits";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, CalendarDays } from "lucide-react";
import { toast } from "sonner";

const FREQS = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "semimonthly", label: "Twice monthly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom" },
] as const;

export function IncomePage() {
  const { data = [], isLoading } = useIncome();
  const upsert = useUpsertIncome();
  const del = useDeleteIncome();
  const [editing, setEditing] = useState<IncomeSource | null>(null);
  const [open, setOpen] = useState(false);

  const now = new Date();
  const totalMonth = data.reduce((s, i) => {
    const occ = incomeOccurrencesInMonth(i.payday_date, i.frequency, now.getFullYear(), now.getMonth());
    return s + i.amount * occ.length;
  }, 0);

  const allPaydays = data
    .flatMap(i =>
      incomeOccurrencesInMonth(i.payday_date, i.frequency, now.getFullYear(), now.getMonth()).map(d => ({
        name: i.name,
        amount: i.amount,
        date: d,
      })),
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const onAdd = () => {
    setEditing(null);
    setOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Income"
        description={`Total this month: ${fmtMoney(totalMonth)}`}
        action={
          <Button onClick={onAdd}><Plus className="size-4 mr-1" />Add income</Button>
        }
      />

      <IncomeDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSubmit={async row => {
          await upsert.mutateAsync(row);
          setOpen(false);
          toast.success(editing ? "Updated" : "Added");
        }}
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
                  <div>
                    <div className="font-medium">{i.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {i.frequency.replace("semi", "twice ")} · starts {new Date(i.payday_date + "T00:00:00").toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="font-semibold text-success">{fmtMoney(i.amount)}</div>
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(i); setOpen(true); }}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => del.mutate(i.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
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
    </div>
  );
}

function IncomeDialog({
  open,
  onOpenChange,
  editing,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: IncomeSource | null;
  onSubmit: (row: Partial<IncomeSource> & { id?: string }) => Promise<void>;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [amount, setAmount] = useState<string>(String(editing?.amount ?? ""));
  const [payday, setPayday] = useState(editing?.payday_date ?? new Date().toISOString().slice(0, 10));
  const [frequency, setFrequency] = useState<IncomeSource["frequency"]>(editing?.frequency ?? "biweekly");

  // reset state when editing changes
  useStateSync({ open, editing }, () => {
    setName(editing?.name ?? "");
    setAmount(String(editing?.amount ?? ""));
    setPayday(editing?.payday_date ?? new Date().toISOString().slice(0, 10));
    setFrequency(editing?.frequency ?? "biweekly");
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name is required");
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter a valid amount");
    await onSubmit({ id: editing?.id, name: name.trim(), amount: amt, payday_date: payday, frequency });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit income" : "Add income"}</DialogTitle></DialogHeader>
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
              <Label>First payday</Label>
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{editing ? "Save" : "Add"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect } from "react";
function useStateSync<T>(deps: T, fn: () => void) {
  // re-init when open/editing change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(fn, [JSON.stringify(deps)]);
}
