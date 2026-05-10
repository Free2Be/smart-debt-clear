import { useEffect, useMemo, useState } from "react";
import {
  useCards, useUpsertCard, useDeleteCard,
  useCardPayments, useAddCardPayment,
  useCardInterestCharges, useAddInterestCharge,
  type CreditCard,
} from "@/lib/data";
import { fmtMoney, fmtMoneyCents, todayISO, estimateMonthlyInterest } from "@/lib/finance";
import { PageHeader, EmptyState, StatCard } from "@/components/ui-bits";
import { ConfirmDelete } from "@/components/confirm-delete";
import { downloadCSV } from "@/lib/export-csv";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, DollarSign, Percent, Download, History } from "lucide-react";
import { toast } from "sonner";

export function CardsPage() {
  const { data = [], isLoading } = useCards();
  const upsert = useUpsertCard();
  const del = useDeleteCard();
  const [editing, setEditing] = useState<CreditCard | null>(null);
  const [open, setOpen] = useState(false);
  const [payCard, setPayCard] = useState<CreditCard | null>(null);
  const [intCard, setIntCard] = useState<CreditCard | null>(null);
  const [historyCard, setHistoryCard] = useState<CreditCard | null>(null);

  const totalBal = data.reduce((s, c) => s + c.balance, 0);
  const totalLimit = data.reduce((s, c) => s + c.credit_limit, 0);
  const totalMin = data.reduce((s, c) => s + c.minimum_payment, 0);
  const totalStmt = data.reduce((s, c) => s + (c.statement_balance ?? 0), 0);
  const util = totalLimit > 0 ? (totalBal / totalLimit) * 100 : 0;

  const handleExport = () => {
    downloadCSV("credit-cards.csv", data.map(c => ({
      name: c.name, balance: c.balance, credit_limit: c.credit_limit, apr: c.apr,
      minimum_payment: c.minimum_payment, statement_balance: c.statement_balance,
      statement_due_date: c.statement_due_date ?? "",
      due_day: c.due_day ?? "", statement_day: c.statement_day ?? "",
    })));
  };

  return (
    <div>
      <PageHeader
        title="Credit Cards"
        action={
          <div className="flex gap-2">
            {data.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="size-4 mr-1" />Export
              </Button>
            )}
            <Button onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="size-4 mr-1" />Add card
            </Button>
          </div>
        }
      />

      <CardDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSubmit={async row => {
          await upsert.mutateAsync(row);
          setOpen(false);
          toast.success(editing ? "Updated" : "Added");
        }}
      />

      <PaymentDialog card={payCard} onClose={() => setPayCard(null)} />
      <InterestDialog card={intCard} onClose={() => setIntCard(null)} />
      <HistoryDialog card={historyCard} onClose={() => setHistoryCard(null)} />

      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>
      ) : data.length === 0 ? (
        <EmptyState title="No credit cards yet" description="Add cards to see your payoff plan and interest savings."
          action={<Button onClick={() => setOpen(true)}><Plus className="size-4 mr-1" />Add card</Button>} />
      ) : (
        <>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-4">
            <StatCard label="Total debt" value={fmtMoney(totalBal)} tone={totalBal > 0 ? "destructive" : "default"} />
            <StatCard label="Pay interest-free" value={fmtMoney(totalStmt)} tone="success" hint="Sum of statement balances" />
            <StatCard label="Utilization" value={`${util.toFixed(0)}%`} tone={util > 30 ? "warning" : "info"} />
            <StatCard label="Min payments" value={fmtMoney(totalMin)} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {data.map(c => {
              const cu = c.credit_limit > 0 ? (c.balance / c.credit_limit) * 100 : 0;
              const tone = cu > 50 ? "text-destructive" : cu > 30 ? "text-warning" : "text-info";
              const monthlyInt = estimateMonthlyInterest(Math.max(0, c.balance - c.statement_balance), c.apr);
              return (
                <Card key={c.id} className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        APR {c.apr}% · Min {fmtMoney(c.minimum_payment)}{c.due_day ? ` · Due day ${c.due_day}` : ""}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setHistoryCard(c)} title="History">
                        <History className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setOpen(true); }} title="Edit">
                        <Pencil className="size-4" />
                      </Button>
                      <ConfirmDelete
                        title={`Delete ${c.name}?`}
                        description="This card and its records will be removed from your dashboard. Payment and interest history stays in the database for audit."
                        onConfirm={() => del.mutateAsync(c.id)}
                        trigger={
                          <Button variant="ghost" size="icon" title="Delete">
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        }
                      />
                    </div>
                  </div>
                  <div className="text-2xl font-bold tracking-tight mb-1">{fmtMoney(c.balance)}</div>
                  <div className="text-xs text-muted-foreground mb-3">of {fmtMoney(c.credit_limit)} limit</div>
                  {c.statement_balance > 0 && (
                    <div className="rounded-md border border-border bg-accent/40 p-3 mb-3 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Pay to avoid interest</span>
                        <span className="font-semibold text-success">{fmtMoney(c.statement_balance)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Pending (post-statement)</span>
                        <span className="font-medium">{fmtMoney(Math.max(0, c.balance - c.statement_balance))}</span>
                      </div>
                      {c.statement_due_date && (
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Due by</span>
                          <span className="font-medium">
                            {new Date(c.statement_due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {monthlyInt > 0 && (
                    <div className="text-xs text-warning mb-2">
                      Estimated interest if unpaid: {fmtMoneyCents(monthlyInt)}/mo
                    </div>
                  )}
                  <Progress value={Math.min(100, cu)} />
                  <div className={`text-xs mt-1 mb-3 font-medium ${tone}`}>{cu.toFixed(0)}% used</div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="default" className="flex-1" onClick={() => setPayCard(c)}>
                      <DollarSign className="size-4 mr-1" />Payment
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setIntCard(c)}>
                      <Percent className="size-4 mr-1" />Interest
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function PaymentDialog({ card, onClose }: { card: CreditCard | null; onClose: () => void }) {
  const add = useAddCardPayment();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [type, setType] = useState<string>("manual");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (card) {
      setAmount(String(card.statement_balance > 0 ? card.statement_balance : card.minimum_payment || 0));
      setDate(todayISO()); setType(card.statement_balance > 0 ? "statement" : "manual"); setNotes("");
    }
  }, [card]);

  if (!card) return null;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter a valid amount");
    await add.mutateAsync({ card, amount: amt, payment_date: date, payment_type: type, notes: notes.trim() || null });
    toast.success("Payment recorded");
    onClose();
  };

  return (
    <Dialog open={!!card} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment — {card.name}</DialogTitle>
          <DialogDescription>Reduces balance and statement balance automatically.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Payment type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="statement">Statement (interest-free)</SelectItem>
                <SelectItem value="minimum">Minimum payment</SelectItem>
                <SelectItem value="extra">Extra principal</SelectItem>
                <SelectItem value="manual">Manual / other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional" />
          </div>
          <div className="rounded-md bg-accent/40 border border-border p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Current balance</span><span>{fmtMoney(card.balance)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">After payment</span><span className="font-semibold">{fmtMoney(Math.max(0, card.balance - Number(amount || 0)))}</span></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Record</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InterestDialog({ card, onClose }: { card: CreditCard | null; onClose: () => void }) {
  const add = useAddInterestCharge();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (card) {
      const est = estimateMonthlyInterest(Math.max(0, card.balance - card.statement_balance), card.apr);
      setAmount(est > 0 ? est.toFixed(2) : "");
      setDate(todayISO()); setNotes("");
    }
  }, [card]);

  if (!card) return null;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter a valid amount");
    await add.mutateAsync({ card, amount: amt, charge_date: date, notes: notes.trim() || null });
    toast.success("Interest charge recorded");
    onClose();
  };

  return (
    <Dialog open={!!card} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record interest — {card.name}</DialogTitle>
          <DialogDescription>Adds the interest amount to your balance.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Interest amount</Label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Charge date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Record</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ card, onClose }: { card: CreditCard | null; onClose: () => void }) {
  const { data: payments = [] } = useCardPayments(card?.id);
  const { data: charges = [] } = useCardInterestCharges(card?.id);
  const items = useMemo(() => {
    const a = payments.map(p => ({ kind: "payment" as const, date: p.payment_date, amount: p.amount, label: p.payment_type, notes: p.notes }));
    const b = charges.map(c => ({ kind: "interest" as const, date: c.charge_date, amount: c.amount, label: `${c.apr_at_time}% APR`, notes: c.notes }));
    return [...a, ...b].sort((x, y) => y.date.localeCompare(x.date));
  }, [payments, charges]);

  if (!card) return null;
  return (
    <Dialog open={!!card} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{card.name} — history</DialogTitle>
          <DialogDescription>Recent payments and interest charges.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto -mx-2">
          {items.length === 0 ? (
            <div className="text-sm text-muted-foreground p-6 text-center">No history yet.</div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((it, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-2 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium capitalize">
                      {it.kind === "payment" ? `Payment · ${it.label}` : `Interest · ${it.label}`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(it.date + "T00:00:00").toLocaleDateString()}{it.notes ? ` · ${it.notes}` : ""}
                    </div>
                  </div>
                  <div className={`font-semibold ${it.kind === "payment" ? "text-success" : "text-destructive"}`}>
                    {it.kind === "payment" ? "−" : "+"}{fmtMoneyCents(it.amount)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CardDialog({ open, onOpenChange, editing, onSubmit }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: CreditCard | null;
  onSubmit: (row: Partial<CreditCard> & { id?: string }) => Promise<void>;
}) {
  const [f, setF] = useState({ name: "", balance: "", credit_limit: "", apr: "", minimum_payment: "", due_day: "", statement_day: "", statement_balance: "", statement_due_date: "" });
  useEffect(() => {
    if (!open) return;
    setF({
      name: editing?.name ?? "",
      balance: editing ? String(editing.balance) : "",
      credit_limit: editing ? String(editing.credit_limit) : "",
      apr: editing ? String(editing.apr) : "",
      minimum_payment: editing ? String(editing.minimum_payment) : "",
      due_day: editing?.due_day ? String(editing.due_day) : "",
      statement_day: editing?.statement_day ? String(editing.statement_day) : "",
      statement_balance: editing ? String(editing.statement_balance ?? 0) : "",
      statement_due_date: editing?.statement_due_date ?? "",
    });
  }, [open, editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return toast.error("Name is required");
    const num = (s: string) => (s === "" ? 0 : Number(s));
    await onSubmit({
      id: editing?.id,
      name: f.name.trim(),
      balance: num(f.balance),
      credit_limit: num(f.credit_limit),
      apr: num(f.apr),
      minimum_payment: num(f.minimum_payment),
      due_day: f.due_day ? Number(f.due_day) : null,
      statement_day: f.statement_day ? Number(f.statement_day) : null,
      statement_balance: num(f.statement_balance),
      statement_due_date: f.statement_due_date || null,
    });
  };

  const F = (k: keyof typeof f, label: string, type = "number", step = "0.01") => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} step={type === "number" ? step : undefined} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit card" : "Add card"}</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Chase Freedom" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {F("balance", "Current balance")}
            {F("credit_limit", "Credit limit")}
            {F("apr", "APR %")}
            {F("minimum_payment", "Minimum payment")}
            {F("statement_balance", "Statement balance (interest-free)")}
            {F("statement_due_date", "Statement due date", "date", "")}
            {F("due_day", "Due day", "number", "1")}
            {F("statement_day", "Statement day", "number", "1")}
          </div>
          <p className="text-xs text-muted-foreground">
            Chase (and most issuers) charge no interest on new purchases if you pay the full <strong>statement balance</strong> by the due date. Anything above that is your pending/remaining balance.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{editing ? "Save" : "Add"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
