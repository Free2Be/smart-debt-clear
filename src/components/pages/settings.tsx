import { useSettings, useUpdateSettings } from "@/lib/data";
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

export function SettingsPage() {
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();

  return (
    <div>
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
      </div>
    </div>
  );
}
