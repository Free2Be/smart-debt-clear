import type { Bill, IncomeSource, CreditCard, SavingsAccount } from "./data";

function escapeCsv(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const head = cols.join(",");
  const body = rows.map(r => cols.map(c => escapeCsv(r[c])).join(",")).join("\n");
  return head + "\n" + body;
}

export function downloadFile(filename: string, content: string, mime = "text/csv") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportAllCSV(data: {
  income: IncomeSource[];
  bills: Bill[];
  cards: CreditCard[];
  savings: SavingsAccount[];
}) {
  const sections = [
    "# INCOME",
    toCSV(data.income.map(i => ({ name: i.name, amount: i.amount, frequency: i.frequency, payday_date: i.payday_date }))),
    "",
    "# BILLS",
    toCSV(data.bills.map(b => ({ name: b.name, amount: b.amount, due_day: b.due_day, category: b.category, autopay: b.autopay, notes: b.notes ?? "" }))),
    "",
    "# CREDIT CARDS",
    toCSV(data.cards.map(c => ({ name: c.name, balance: c.balance, credit_limit: c.credit_limit, apr: c.apr, minimum_payment: c.minimum_payment, due_day: c.due_day ?? "" }))),
    "",
    "# SAVINGS",
    toCSV(data.savings.map(s => ({ name: s.name, balance: s.balance, goal: s.goal, bucket: s.bucket }))),
  ].join("\n");
  downloadFile(`ledger-export-${new Date().toISOString().slice(0, 10)}.csv`, sections);
}

export function exportPDFReport(data: {
  income: IncomeSource[];
  bills: Bill[];
  cards: CreditCard[];
  savings: SavingsAccount[];
  totals: { income: number; bills: number; debt: number; savings: number; remaining: number };
}) {
  // Generate printable HTML and trigger print-to-PDF
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Ledger Report</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#111;padding:32px;max-width:800px;margin:auto}
  h1{margin:0 0 4px;font-size:28px}
  h2{margin:24px 0 8px;font-size:18px;border-bottom:1px solid #ddd;padding-bottom:4px}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}
  .stat{border:1px solid #e5e5e5;border-radius:8px;padding:12px}
  .stat .l{font-size:11px;text-transform:uppercase;color:#666}
  .stat .v{font-size:18px;font-weight:700;margin-top:4px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{text-align:left;padding:8px;border-bottom:1px solid #eee}
  th{background:#fafafa;font-weight:600}
  .muted{color:#666;font-size:12px}
  @media print {body{padding:16px}}
</style></head><body>
<h1>Ledger Financial Report</h1>
<div class="muted">Generated ${new Date().toLocaleString()}</div>
<div class="grid">
  <div class="stat"><div class="l">Income</div><div class="v" style="color:#16a34a">${fmt(data.totals.income)}</div></div>
  <div class="stat"><div class="l">Bills</div><div class="v">${fmt(data.totals.bills)}</div></div>
  <div class="stat"><div class="l">After bills</div><div class="v" style="color:${data.totals.remaining >= 0 ? "#16a34a" : "#dc2626"}">${fmt(data.totals.remaining)}</div></div>
  <div class="stat"><div class="l">Card debt</div><div class="v" style="color:#dc2626">${fmt(data.totals.debt)}</div></div>
</div>
<h2>Income sources</h2>
<table><thead><tr><th>Name</th><th>Amount</th><th>Frequency</th><th>First payday</th></tr></thead><tbody>
${data.income.map(i => `<tr><td>${i.name}</td><td>${fmt(i.amount)}</td><td>${i.frequency}</td><td>${i.payday_date}</td></tr>`).join("") || '<tr><td colspan="4" class="muted">No income sources.</td></tr>'}
</tbody></table>
<h2>Bills</h2>
<table><thead><tr><th>Name</th><th>Amount</th><th>Day</th><th>Category</th></tr></thead><tbody>
${data.bills.map(b => `<tr><td>${b.name}</td><td>${fmt(b.amount)}</td><td>${b.due_day}</td><td>${b.category}</td></tr>`).join("") || '<tr><td colspan="4" class="muted">No bills.</td></tr>'}
</tbody></table>
<h2>Credit cards</h2>
<table><thead><tr><th>Name</th><th>Balance</th><th>Limit</th><th>APR</th><th>Min</th></tr></thead><tbody>
${data.cards.map(c => `<tr><td>${c.name}</td><td>${fmt(c.balance)}</td><td>${fmt(c.credit_limit)}</td><td>${c.apr}%</td><td>${fmt(c.minimum_payment)}</td></tr>`).join("") || '<tr><td colspan="5" class="muted">No cards.</td></tr>'}
</tbody></table>
<h2>Savings</h2>
<table><thead><tr><th>Name</th><th>Balance</th><th>Goal</th><th>Bucket</th></tr></thead><tbody>
${data.savings.map(s => `<tr><td>${s.name}</td><td>${fmt(s.balance)}</td><td>${fmt(s.goal)}</td><td>${s.bucket}</td></tr>`).join("") || '<tr><td colspan="4" class="muted">No savings.</td></tr>'}
</tbody></table>
<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
