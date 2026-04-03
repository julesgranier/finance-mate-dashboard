import { NextRequest } from "next/server";
import { getTransactions } from "@/lib/qonto";
import {
  categorizeTransactions,
  aggregateActuals,
  aggregateDetails,
  SECTIONS,
  getBudget,
} from "@/lib/categorizer";

function esc(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function money(n: number): string {
  if (n === 0) return "-";
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`;
}

function pct(actual: number, budget: number): string {
  if (budget === 0) return actual > 0 ? "100%" : "0%";
  return `${Math.round((actual / budget) * 100)}%`;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const monthParam = body.month;

  if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
    return Response.json(
      { error: "Parameter 'month' required in YYYY-MM format" },
      { status: 400 }
    );
  }

  const [year, month] = monthParam.split("-").map(Number);

  try {
    const transactions = await getTransactions(month, year);
    const categorized = categorizeTransactions(transactions);
    const actuals = aggregateActuals(categorized);
    const details = aggregateDetails(categorized);

    const lines: string[] = [];

    lines.push(`MATE — FINANCE TRACKER ${monthParam},,,,,`);
    lines.push("");
    lines.push("Category,Budget (€),Actual (€),Variance (€),% Used,Date,Counterparty");
    lines.push("");

    for (const section of SECTIONS) {
      lines.push(section.header);
      let secBudget = 0;
      let secActual = 0;

      for (const item of section.items) {
        const b = getBudget(section.key, item);
        const key = `${section.key}|${item}`;
        const a = actuals[key] || 0;
        const v = b - a;
        const txs = details[key] || [];
        secBudget += b;
        secActual += a;

        if (txs.length === 0) {
          // No transactions — single line
          lines.push(
            [esc(`  ${item}`), money(b), money(a), money(v), pct(a, b), "", ""].join(",")
          );
        } else if (txs.length === 1) {
          // Single transaction — inline date + counterparty
          lines.push(
            [esc(`  ${item}`), money(b), money(a), money(v), pct(a, b), txs[0].date, esc(txs[0].counterparty)].join(",")
          );
        } else {
          // Multiple transactions — category totals then detail lines
          lines.push(
            [esc(`  ${item}`), money(b), money(a), money(v), pct(a, b), "", `${txs.length} transactions`].join(",")
          );
          for (const tx of txs) {
            lines.push(
              [esc(`      ↳ ${tx.counterparty || "—"}`), "", money(tx.amount), "", "", tx.date, ""].join(",")
            );
          }
        }
      }

      const secVar = secBudget - secActual;
      lines.push(
        [section.total, money(secBudget), money(secActual), money(secVar), pct(secActual, secBudget), "", ""].join(",")
      );
      lines.push("");
    }

    // Uncategorized
    const uncategorized = categorized.filter(
      (t) => t.category === "UNCATEGORIZED" && t.side === "debit"
    );
    if (uncategorized.length > 0) {
      lines.push(`UNCATEGORIZED (${uncategorized.length} transactions)`);
      for (const tx of uncategorized) {
        const name = tx.counterparty_name || tx.label || "unknown";
        const note = tx.categorizer_note || "";
        const date = (tx.date || "").slice(0, 10);
        lines.push([esc(`  ${name}`), "", money(tx.amount), "", note, date, ""].join(","));
      }
    }

    const csv = lines.join("\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="finance_${monthParam}.csv"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
