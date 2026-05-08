import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useUpsertIncome, useUpsertBill, useUpsertCard, useUpdateSettings } from "@/lib/data";
import { Wallet, Receipt, CreditCard, PartyPopper } from "lucide-react";
import { toast } from "sonner";

export function SetupWizard({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [step, setStep] = useState(0);
  const upsertIncome = useUpsertIncome();
  const upsertBill = useUpsertBill();
  const upsertCard = useUpsertCard();
  const updateSettings = useUpdateSettings();

  const [income, setIncome] = useState({ name: "", amount: "", frequency: "biweekly" as const, payday_date: new Date().toISOString().slice(0, 10) });
  const [bill, setBill] = useState({ name: "", amount: "", due_day: "1" });
  const [card, setCard] = useState({ name: "", balance: "", credit_limit: "", apr: "", minimum_payment: "" });
  const [strategy, setStrategy] = useState<"avalanche" | "snowball">("avalanche");
  const [extra, setExtra] = useState("0");

  const close = () => {
    setStep(0);
    onOpenChange(false);
    localStorage.setItem("ledger-wizard-done", "1");
  };

  const finish = async () => {
    try {
      const tasks: Promise<unknown>[] = [];
      if (income.name && income.amount) tasks.push(upsertIncome.mutateAsync({ ...income, amount: Number(income.amount) }));
      if (bill.name && bill.amount) tasks.push(upsertBill.mutateAsync({ name: bill.name, amount: Number(bill.amount), due_day: Number(bill.due_day) || 1, category: "Other", autopay: false }));
      if (card.name && card.balance) tasks.push(upsertCard.mutateAsync({
        name: card.name, balance: Number(card.balance), credit_limit: Number(card.credit_limit) || 0,
        apr: Number(card.apr) || 0, minimum_payment: Number(card.minimum_payment) || 0,
      }));
      tasks.push(updateSettings.mutateAsync({ payoff_strategy: strategy, extra_monthly_payment: Number(extra) || 0 }));
      await Promise.all(tasks);
      toast.success("Setup complete!");
      close();
    } catch {
      toast.error("Something went wrong");
    }
  };

  const steps = [
    { icon: <PartyPopper className="size-6" />, title: "Welcome to Ledger" },
    { icon: <Wallet className="size-6" />, title: "Add your income" },
    { icon: <Receipt className="size-6" />, title: "Add a bill" },
    { icon: <CreditCard className="size-6" />, title: "Add a credit card" },
    { icon: <PartyPopper className="size-6" />, title: "Choose payoff plan" },
  ];

  const pct = ((step + 1) / steps.length) * 100;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); else onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="size-10 rounded-xl bg-primary/10 text-primary grid place-items-center">{steps[step].icon}</div>
            <DialogTitle>{steps[step].title}</DialogTitle>
          </div>
          <Progress value={pct} className="h-1.5" />
        </DialogHeader>

        <div className="py-2 min-h-48">
          {step === 0 && (
            <div className="space-y-3 text-sm">
              <p>Let's set up your financial picture in a minute. We'll add:</p>
              <ul className="space-y-2 text-muted-foreground">
                <li>• One income source (you can add more later)</li>
                <li>• A recurring bill</li>
                <li>• A credit card to start your payoff plan</li>
                <li>• Your preferred payoff strategy</li>
              </ul>
              <p className="text-xs text-muted-foreground pt-2">You can skip any step and add more later.</p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <Field label="Source name"><Input value={income.name} onChange={e => setIncome({ ...income, name: e.target.value })} placeholder="Day job" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount per payday"><Input type="number" value={income.amount} onChange={e => setIncome({ ...income, amount: e.target.value })} /></Field>
                <Field label="Frequency">
                  <Select value={income.frequency} onValueChange={v => setIncome({ ...income, frequency: v as typeof income.frequency })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Biweekly</SelectItem>
                      <SelectItem value="semimonthly">Twice monthly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Next payday"><Input type="date" value={income.payday_date} onChange={e => setIncome({ ...income, payday_date: e.target.value })} /></Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <Field label="Bill name"><Input value={bill.name} onChange={e => setBill({ ...bill, name: e.target.value })} placeholder="Rent" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount"><Input type="number" value={bill.amount} onChange={e => setBill({ ...bill, amount: e.target.value })} /></Field>
                <Field label="Due day"><Input type="number" min="1" max="31" value={bill.due_day} onChange={e => setBill({ ...bill, due_day: e.target.value })} /></Field>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <Field label="Card name"><Input value={card.name} onChange={e => setCard({ ...card, name: e.target.value })} placeholder="Visa" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Balance"><Input type="number" value={card.balance} onChange={e => setCard({ ...card, balance: e.target.value })} /></Field>
                <Field label="Credit limit"><Input type="number" value={card.credit_limit} onChange={e => setCard({ ...card, credit_limit: e.target.value })} /></Field>
                <Field label="APR %"><Input type="number" value={card.apr} onChange={e => setCard({ ...card, apr: e.target.value })} /></Field>
                <Field label="Min payment"><Input type="number" value={card.minimum_payment} onChange={e => setCard({ ...card, minimum_payment: e.target.value })} /></Field>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <Field label="Payoff strategy">
                <Select value={strategy} onValueChange={v => setStrategy(v as typeof strategy)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="avalanche">Avalanche (highest APR first — saves most interest)</SelectItem>
                    <SelectItem value="snowball">Snowball (smallest balance first — quick wins)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Extra payment per month">
                <Input type="number" value={extra} onChange={e => setExtra(e.target.value)} />
              </Field>
              <p className="text-xs text-muted-foreground">Even $50 extra a month can dramatically reduce interest paid.</p>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 pt-2">
          <Button variant="ghost" onClick={close}>Skip setup</Button>
          <div className="flex gap-2">
            {step > 0 && <Button variant="outline" onClick={() => setStep(s => s - 1)}>Back</Button>}
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep(s => s + 1)}>{step === 0 ? "Get started" : "Next"}</Button>
            ) : (
              <Button onClick={finish}>Finish</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
