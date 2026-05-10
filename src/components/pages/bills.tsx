import { useEffect, useMemo, useState } from "react";
import {
  useBills, useUpsertBill, useDeleteBill, useBillPayments, useTogglePaid, type Bill,
  useOneTimeExpenses, useUpsertOneTimeExpense, useDeleteOneTimeExpense, type OneTimeExpense,
} from "@/lib/data";
import { fmtMoney, BILL_CATEGORIES, todayISO } from "@/lib/finance";
import { PageHeader, EmptyState } from "@/components/ui-bits";
import { ConfirmDelete } from "@/components/confirm-delete";
import { downloadCSV } from "@/lib/export-csv";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function BillsPage() {
  const now = new Date();
  const periodMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  return (
    <div>
      <PageHeader title="Bills & Expenses" description="Recurring bills and one-time expenses for this month." />
      <Tabs defaultValue="recurring">
        <TabsList className="mb-4">
          <TabsTrigger value="recurring">Recurring bills</TabsTrigger>
          <TabsTrigger value="onetime">One-time expenses</TabsTrigger>
        </TabsList>
        <TabsContent value="recurring"><RecurringBills periodMonth={periodMonth} now={now} /></TabsContent>
        <TabsContent value="onetime"><OneTimeExpensesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function RecurringBills({ periodMonth, now }: { periodMonth: string; now: Date }) {
  const { data = [], isLoading } = useBills();
  const upsert = useUpsertBill();
  const del = useDeleteBill();
  const { data: payments = [] } = useBillPayments(periodMonth);
  const toggle = useTogglePaid();
  const [editing, setEditing] = useState<Bill | null>(null);
  const [open, setOpen] = useState(false);

  const paidIds = useMemo(() => new Set(payments.map(p => p.bill_id)), [payments]);
  const total = data.reduce((s, b) => s + b.amount, 0);
  const paidTotal = data.filter(b => paidIds.has(b.id)).reduce((s, b) => s + b.amount, 0);

  const handleExport = () => {
    downloadCSV("bills.csv", data.map(b => ({
      name: b.name, amount: b.amount, due_day: b.due_day, category: b.category,
      autopay: b.autopay, paid_this_month: paidIds.has(b.id), notes: b.notes ?? "",
    })));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="text-sm text-muted-foreground">
          {fmtMoney(paidTotal)} paid of {fmtMoney(total)} this month
        </div>
        <div className="flex gap-2">
          {data.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="size-4 mr-1" />Export
            </Button>
          )}
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="size-4 mr-1" />Add bill
          </Button>
        </div>
      </div>

      <BillDialog
        open={open} onOpenChange={setOpen} editing={editing}
        onSubmit={async row => { await upsert.mutateAsync(row); setOpen(false); toast.success(editing ? "Updated" : "Added"); }}
      />

      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>
      ) : data.length === 0 ? (
        <EmptyState
          title="No bills yet"
          description="Add rent, utilities, subscriptions and other recurring monthly expenses."
          action={<Button onClick={() => setOpen(true)}><Plus className="size-4 mr-1" />Add your first bill</Button>}
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <ul>
            {[...data].sort((a, b) => a.due_day - b.due_day).map(b => {
              const paid = paidIds.has(b.id);
              const today = now.getDate();
              const overdue = !paid && b.due_day < today;
              const dueSoon = !paid && b.due_day >= today && b.due_day - today <= 3;
              return (
                <li key={b.id} className={cn("flex items-center gap-3 p-4 border-b border-border last:border-0", paid && "opacity-60")}>
                  <Checkbox checked={paid} onCheckedChange={v => toggle.mutate({ billId: b.id, periodMonth, paid: !!v })} />
                  <div className="flex-1 min-w-0">
                    <div className={cn("font-medium truncate", paid && "line-through")}>{b.name}</div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2 gap-y-1 items-center">
                      <span>{b.category}</span>
                      <span>· Day {b.due_day}</span>
                      {b.autopay && <Badge variant="secondary" className="text-[10px]">Autopay</Badge>}
                      {overdue && <Badge variant="destructive" className="text-[10px]">Overdue</Badge>}
                      {dueSoon && <span className="text-warning font-medium">Due soon</span>}
                      {paid && <Badge className="bg-success text-success-foreground text-[10px]">Paid</Badge>}
                    </div>
                  </div>
                  <div className="font-semibold">{fmtMoney(b.amount)}</div>
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(b); setOpen(true); }}><Pencil className="size-4" /></Button>
                  <ConfirmDelete
                    title={`Delete "${b.name}"?`}
                    description="This recurring bill will be removed. Past payment records remain."
                    onConfirm={() => del.mutateAsync(b.id)}
                    trigger={<Button variant="ghost" size="icon"><Trash2 className="size-4 text-destructive" /></Button>}
                  />
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}

function OneTimeExpensesTab() {
  const { data = [], isLoading } = useOneTimeExpenses();
  const upsert = useUpsertOneTimeExpense();
  const del = useDeleteOneTimeExpense();
  const [editing, setEditing] = useState<OneTimeExpense | null>(null);
  const [open, setOpen] = useState(false);

  const total = data.reduce((s, e) => s + e.amount, 0);
  const paid = data.filter(e => e.paid).reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="text-sm text-muted-foreground">
          {fmtMoney(paid)} paid of {fmtMoney(total)} planned
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="size-4 mr-1" />Add expense
        </Button>
      </div>

      <OneTimeDialog
        open={open} onOpenChange={setOpen} editing={editing}
        onSubmit={async row => { await upsert.mutateAsync(row); setOpen(false); toast.success(editing ? "Updated" : "Added"); }}
      />

      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>
      ) : data.length === 0 ? (
        <EmptyState
          title="No one-time expenses"
          description="Track non-recurring costs like a car repair, vet visit, or annual fee."
          action={<Button onClick={() => setOpen(true)}><Plus className="size-4 mr-1" />Add expense</Button>}
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <ul>
            {[...data].sort((a, b) => a.expense_date.localeCompare(b.expense_date)).map(e => (
              <li key={e.id} className={cn("flex items-center gap-3 p-4 border-b border-border last:border-0", e.paid && "opacity-60")}>
                <Checkbox checked={e.paid} onCheckedChange={v => upsert.mutate({ id: e.id, paid: !!v })} />
                <div className="flex-1 min-w-0">
                  <div className={cn("font-medium truncate", e.paid && "line-through")}>{e.name}</div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                    <span>{e.category}</span>
                    <span>· {new Date(e.expense_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    {e.paid && <Badge className="bg-success text-success-foreground text-[10px]">Paid</Badge>}
                  </div>
                </div>
                <div className="font-semibold">{fmtMoney(e.amount)}</div>
                <Button variant="ghost" size="icon" onClick={() => { setEditing(e); setOpen(true); }}><Pencil className="size-4" /></Button>
                <ConfirmDelete
                  title={`Delete "${e.name}"?`}
                  onConfirm={() => del.mutateAsync(e.id)}
                  trigger={<Button variant="ghost" size="icon"><Trash2 className="size-4 text-destructive" /></Button>}
                />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function BillDialog({ open, onOpenChange, editing, onSubmit }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: Bill | null;
  onSubmit: (row: Partial<Bill> & { id?: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("1");
  const [category, setCategory] = useState<string>("Other");
  const [autopay, setAutopay] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setAmount(editing ? String(editing.amount) : "");
    setDueDay(editing ? String(editing.due_day) : "1");
    setCategory(editing?.category ?? "Other");
    setAutopay(editing?.autopay ?? false);
    setNotes(editing?.notes ?? "");
  }, [open, editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name is required");
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter a valid amount");
    const day = Number(dueDay);
    if (!Number.isInteger(day) || day < 1 || day > 31) return toast.error("Due day must be 1–31");
    await onSubmit({ id: editing?.id, name: name.trim(), amount: amt, due_day: day, category, autopay, notes: notes.trim() || null });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit bill" : "Add bill"}</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Electricity" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Due day of month</Label>
              <Input type="number" min="1" max="31" value={dueDay} onChange={e => setDueDay(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{BILL_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <div className="text-sm font-medium">Autopay</div>
              <div className="text-xs text-muted-foreground">This bill is paid automatically.</div>
            </div>
            <Switch checked={autopay} onCheckedChange={setAutopay} />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Optional" />
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

function OneTimeDialog({ open, onOpenChange, editing, onSubmit }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: OneTimeExpense | null;
  onSubmit: (row: Partial<OneTimeExpense> & { id?: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [category, setCategory] = useState<string>("Other");
  const [notes, setNotes] = useState("");
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setAmount(editing ? String(editing.amount) : "");
    setDate(editing?.expense_date ?? todayISO());
    setCategory(editing?.category ?? "Other");
    setNotes(editing?.notes ?? "");
    setPaid(editing?.paid ?? false);
  }, [open, editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name is required");
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter a valid amount");
    await onSubmit({ id: editing?.id, name: name.trim(), amount: amt, expense_date: date, category, notes: notes.trim() || null, paid });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit expense" : "Add one-time expense"}</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Car repair" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{BILL_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <div className="text-sm font-medium">Already paid</div>
              <div className="text-xs text-muted-foreground">Mark as paid right away.</div>
            </div>
            <Switch checked={paid} onCheckedChange={setPaid} />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional" />
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
