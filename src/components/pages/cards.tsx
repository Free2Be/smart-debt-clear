import { useEffect, useState } from "react";
import { useCards, useUpsertCard, useDeleteCard, type CreditCard } from "@/lib/data";
import { fmtMoney } from "@/lib/finance";
import { PageHeader, EmptyState, StatCard } from "@/components/ui-bits";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function CardsPage() {
  const { data = [], isLoading } = useCards();
  const upsert = useUpsertCard();
  const del = useDeleteCard();
  const [editing, setEditing] = useState<CreditCard | null>(null);
  const [open, setOpen] = useState(false);

  const totalBal = data.reduce((s, c) => s + c.balance, 0);
  const totalLimit = data.reduce((s, c) => s + c.credit_limit, 0);
  const totalMin = data.reduce((s, c) => s + c.minimum_payment, 0);
  const util = totalLimit > 0 ? (totalBal / totalLimit) * 100 : 0;

  return (
    <div>
      <PageHeader
        title="Credit Cards"
        action={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4 mr-1" />Add card</Button>}
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

      {isLoading ? (
        <Card className="p-6 text-sm text-muted-foreground">Loading…</Card>
      ) : data.length === 0 ? (
        <EmptyState title="No credit cards yet" description="Add cards to see your payoff plan and interest savings."
          action={<Button onClick={() => setOpen(true)}><Plus className="size-4 mr-1" />Add card</Button>} />
      ) : (
        <>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-4">
            <StatCard label="Total debt" value={fmtMoney(totalBal)} tone={totalBal > 0 ? "destructive" : "default"} />
            <StatCard label="Total limit" value={fmtMoney(totalLimit)} />
            <StatCard label="Utilization" value={`${util.toFixed(0)}%`} tone={util > 30 ? "warning" : "info"} />
            <StatCard label="Min payments" value={fmtMoney(totalMin)} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {data.map(c => {
              const cu = c.credit_limit > 0 ? (c.balance / c.credit_limit) * 100 : 0;
              const tone = cu > 50 ? "text-destructive" : cu > 30 ? "text-warning" : "text-info";
              return (
                <Card key={c.id} className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-xs text-muted-foreground">APR {c.apr}% · Min {fmtMoney(c.minimum_payment)}{c.due_day ? ` · Due day ${c.due_day}` : ""}</div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="size-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => del.mutate(c.id)}><Trash2 className="size-4 text-destructive" /></Button>
                    </div>
                  </div>
                  <div className="text-2xl font-bold tracking-tight mb-1">{fmtMoney(c.balance)}</div>
                  <div className="text-xs text-muted-foreground mb-2">of {fmtMoney(c.credit_limit)} limit</div>
                  <Progress value={Math.min(100, cu)} />
                  <div className={`text-xs mt-1 font-medium ${tone}`}>{cu.toFixed(0)}% used</div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
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
