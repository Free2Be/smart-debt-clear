import { useSettings, useUpdateSettings, useIncome, useBills, useCards, useSavings } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { PageHeader } from "@/components/ui-bits";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Download, FileText, Wand2 } from "lucide-react";
import { exportAllCSV, exportPDFReport } from "@/lib/export";
import { incomeOccurrencesInMonth } from "@/lib/finance";
import { useState } from "react";
import { SetupWizard } from "@/components/setup-wizard";

export function SettingsPage() {
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();

  const { data: income = [] } = useIncome();
  const { data: bills = [] } = useBills();
  const { data: cards = [] } = useCards();
  const { data: savings = [] } = useSavings();
  const [wizard, setWizard] = useState(false);

  const onCSV = () => {
    exportAllCSV({ income, bills, cards, savings });
    toast.success("CSV downloaded");
  };
  const onPDF = () => {
    const now = new Date();
    const totalIncome = income.reduce((s, i) => {
      const occ = incomeOccurrencesInMonth(i.payday_date, i.frequency, now.getFullYear(), now.getMonth());
      return s + i.amount * occ.length;
    }, 0);
    const totalBills = bills.reduce((s, b) => s + b.amount, 0);
    const totalDebt = cards.reduce((s, c) => s + c.balance, 0);
    const totalSavings = savings.reduce((s, a) => s + a.balance, 0);
    const totalMin = cards.reduce((s, c) => s + c.minimum_payment, 0);
    exportPDFReport({
      income, bills, cards, savings,
      totals: { income: totalIncome, bills: totalBills, debt: totalDebt, savings: totalSavings, remaining: totalIncome - totalBills - totalMin },
    });
  };

  return (
    <div>
      <SetupWizard open={wizard} onOpenChange={setWizard} />
      <PageHeader title="Settings" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5 space-y-4">
          <h3 className="font-semibold">Account</h3>
          <div className="text-sm"><span className="text-muted-foreground">Email: </span>{user?.email}</div>
          <Button variant="outline" onClick={async () => { await signOut(); nav({ to: "/login" }); }}>Sign out</Button>
        </Card>

        <Card className="p-5 space-y-4">
          <h3 className="font-semibold">Preferences</h3>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Dark mode</div>
              <div className="text-xs text-muted-foreground">Toggle dark theme.</div>
            </div>
            <Switch checked={theme === "dark"} onCheckedChange={toggle} />
          </div>
          <div className="space-y-2">
            <Label>Safe minimum checking balance</Label>
            <Input
              type="number"
              step="10"
              defaultValue={settings?.safe_minimum_balance ?? 0}
              onBlur={e => {
                update.mutate(
                  { safe_minimum_balance: Number(e.target.value) || 0 },
                  { onSuccess: () => toast.success("Saved") },
                );
              }}
            />
            <p className="text-xs text-muted-foreground">Money to always keep in checking before extra payments.</p>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h3 className="font-semibold">Export your data</h3>
          <p className="text-sm text-muted-foreground">Download your finances for backup or analysis.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onCSV}><Download className="size-4 mr-2" />Export CSV</Button>
            <Button variant="outline" onClick={onPDF}><FileText className="size-4 mr-2" />Print PDF report</Button>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h3 className="font-semibold">Setup</h3>
          <p className="text-sm text-muted-foreground">Run the guided setup wizard again.</p>
          <Button variant="outline" onClick={() => setWizard(true)}><Wand2 className="size-4 mr-2" />Run setup wizard</Button>
        </Card>
      </div>
    </div>
  );
}
