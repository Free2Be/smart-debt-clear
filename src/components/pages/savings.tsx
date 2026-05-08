import { useEffect, useState } from "react";
import { useSavings, useUpsertSavings, useDeleteSavings, type SavingsAccount } from "@/lib/data";
import { fmtMoney, SAVINGS_BUCKETS } from "@/lib/finance";
import { PageHeader, EmptyState, StatCard } from "@/components/ui-bits";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function SavingsPage() {
  const { data = [], isLoading } = useSavings();
  const upsert = useUpsertSavings();
  const del = useDeleteSavings();
  const [editing, setEditing] = useState<SavingsAccount | null>(null);
  const [open, setOpen] = useState(false);
  const total = data.reduce((s, a) => s + a.balance, 0);
  const goalTotal = data.reduce((s, a) => s + a.goal, 0);

  return (
    <div>
      <PageHeader title="Savings"
        action={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4 mr-1" />Add bucket</Button>} />

      <SavingsDialog open={open} onOpenChange={setOpen} editing={editing}
        onSubmit={async row => { await upsert.mutateAsync(row); setOpen(false); toast.success(editing ? "Updated" : "Added"); }} />

      {isLoading ? <Card className="p-6 text-sm text-muted-foreground">Loading…</Card> :
        data.length === 0 ? (
          <EmptyState title="No savings buckets yet" description="Track emergency fund, vacation, house and more."
            action={<Button onClick={() => setOpen(true)}><Plus className="size-4 mr-1" />Add bucket</Button>} />
        ) : (
          <>
            <div className="grid gap-4 grid-cols-2 mb-4">
              <StatCard label="Total saved" value={fmtMoney(total)} tone="info" />
              <StatCard label="Of goal" value={goalTotal > 0 ? `${((total / goalTotal) * 100).toFixed(0)}%` : "—"} hint={goalTotal > 0 ? fmtMoney(goalTotal) + " total goal" : undefined} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {data.map(s => {
                const pct = s.goal > 0 ? (s.balance / s.goal) * 100 : 0;
                return (
                  <Card key={s.id} className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-semibold">{s.name}</div>
                        <div className="text-xs text-muted-foreground capitalize">{s.bucket}</div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(s); setOpen(true); }}><Pencil className="size-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => del.mutate(s.id)}><Trash2 className="size-4 text-destructive" /></Button>
                      </div>
                    </div>
                    <div className="text-2xl font-bold tracking-tight text-info">{fmtMoney(s.balance)}</div>
                    {s.goal > 0 && (
                      <>
                        <div className="text-xs text-muted-foreground mb-1">Goal {fmtMoney(s.goal)} · {pct.toFixed(0)}%</div>
                        <Progress value={Math.min(100, pct)} />
                      </>
                    )}
                  </Card>
                );
              })}
            </div>
          </>
        )}
    </div>
  );
}

function SavingsDialog({ open, onOpenChange, editing, onSubmit }: {
  open: boolean; onOpenChange: (v: boolean) => void; editing: SavingsAccount | null;
  onSubmit: (row: Partial<SavingsAccount> & { id?: string }) => Promise<void>;
}) {
  const [name, setName] = useState(""); const [balance, setBalance] = useState(""); const [goal, setGoal] = useState(""); const [bucket, setBucket] = useState("general");
  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? ""); setBalance(editing ? String(editing.balance) : "");
    setGoal(editing ? String(editing.goal) : ""); setBucket(editing?.bucket ?? "general");
  }, [open, editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name is required");
    await onSubmit({ id: editing?.id, name: name.trim(), balance: Number(balance) || 0, goal: Number(goal) || 0, bucket });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit bucket" : "Add bucket"}</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Balance</Label><Input type="number" step="0.01" value={balance} onChange={e => setBalance(e.target.value)} /></div>
            <div className="space-y-2"><Label>Goal (optional)</Label><Input type="number" step="0.01" value={goal} onChange={e => setGoal(e.target.value)} /></div>
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={bucket} onValueChange={setBucket}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SAVINGS_BUCKETS.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
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
