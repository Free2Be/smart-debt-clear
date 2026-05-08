import { useMemo, useState } from "react";
import { useBills, useIncome, useBillPayments } from "@/lib/data";
import { fmtMoney, incomeOccurrencesInMonth } from "@/lib/finance";
import { PageHeader } from "@/components/ui-bits";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function CalendarPage() {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const periodMonth = `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const { data: bills = [] } = useBills();
  const { data: income = [] } = useIncome();
  const { data: payments = [] } = useBillPayments(periodMonth);
  const paidIds = useMemo(() => new Set(payments.map(p => p.bill_id)), [payments]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = new Date(year, month, 1).getDay();

  const eventsByDay = useMemo(() => {
    const map = new Map<number, { type: "bill" | "pay"; name: string; amount: number; paid?: boolean }[]>();
    for (const b of bills) {
      const day = Math.min(b.due_day, daysInMonth);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push({ type: "bill", name: b.name, amount: b.amount, paid: paidIds.has(b.id) });
    }
    for (const i of income) {
      const occ = incomeOccurrencesInMonth(i.payday_date, i.frequency, year, month);
      for (const d of occ) {
        const day = d.getDate();
        if (!map.has(day)) map.set(day, []);
        map.get(day)!.push({ type: "pay", name: i.name, amount: i.amount });
      }
    }
    return map;
  }, [bills, income, paidIds, year, month, daysInMonth]);

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Bills and paydays at a glance."
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCursor(new Date(year, month - 1, 1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <div className="font-medium text-sm w-36 text-center">{monthLabel}</div>
            <Button variant="outline" size="icon" onClick={() => setCursor(new Date(year, month + 1, 1))}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        }
      />

      <Card className="p-3 md:p-5">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} className="text-xs text-muted-foreground text-center font-medium py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            const events = d ? eventsByDay.get(d) ?? [] : [];
            const isToday = isCurrentMonth && d === today.getDate();
            return (
              <div
                key={i}
                className={cn(
                  "min-h-20 md:min-h-24 rounded-lg border border-border p-1.5 text-left",
                  d == null && "bg-muted/20 border-transparent",
                  isToday && "ring-2 ring-primary",
                )}
              >
                {d && (
                  <>
                    <div className={cn("text-xs font-medium", isToday && "text-primary")}>{d}</div>
                    <div className="space-y-0.5 mt-1">
                      {events.slice(0, 3).map((e, j) => (
                        <div
                          key={j}
                          className={cn(
                            "text-[10px] md:text-[11px] rounded px-1 py-0.5 truncate",
                            e.type === "pay"
                              ? "bg-success/15 text-success"
                              : e.paid
                                ? "bg-muted text-muted-foreground line-through"
                                : "bg-destructive/10 text-destructive",
                          )}
                          title={`${e.name} ${fmtMoney(e.amount)}`}
                        >
                          {e.type === "pay" ? "+" : ""}{fmtMoney(e.amount)} {e.name}
                        </div>
                      ))}
                      {events.length > 3 && (
                        <div className="text-[10px] text-muted-foreground">+{events.length - 3} more</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-3 grid-cols-3 mt-4 text-xs">
        <Legend className="bg-success/15 text-success" label="Payday" />
        <Legend className="bg-destructive/10 text-destructive" label="Bill due" />
        <Legend className="bg-muted text-muted-foreground" label="Paid" />
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn("rounded px-2 py-0.5 font-medium", className)}>•</div>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
