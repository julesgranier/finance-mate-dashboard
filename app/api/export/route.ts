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

    // ═══════════════════════════════════════════
    // SECTION 1 — SUMMARY (Budget vs Actual)
    // ═══════════════════════════════════════════
    lines.push(`MATE — FINANCE TRACKER ${monthParam}`);
    lines.push("");
    lines.push("═══ SUMMARY ═══");
    lines.push("");
    lines.push("Catégorie,Budget (€),Actual (€),Variance (€),% Utilisé");
    lines.push("");

    let totalBudget = 0;
    let totalActual = 0;

    for (const section of SECTIONS) {
      lines.push(section.header);
      let secBudget = 0;
      let secActual = 0;

      for (const item of section.items) {
        const b = getBudget(section.key, item);
        const key = `${section.key}|${item}`;
        const a = actuals[key] || 0;
        const v = b - a;
        secBudget += b;
        secActual += a;

        lines.push(
          [esc(`  ${item}`), money(b), money(a), money(v), pct(a, b)].join(",")
        );
      }

      const secVar = secBudget - secActual;
      lines.push(
        [section.total, money(secBudget), money(secActual), money(secVar), pct(secActual, secBudget)].join(",")
      );
      lines.push("");

      totalBudget += secBudget;
      totalActual += secActual;
    }

    lines.push([
      "TOTAL ALL COSTS",
      money(totalBudget),
      money(totalActual),
      money(totalBudget - totalActual),
      pct(totalActual, totalBudget),
    ].join(","));
    lines.push("");

    // Uncategorized in summary
    const uncategorized = categorized.filter(
      (t) => t.category === "UNCATEGORIZED" && t.side === "debit"
    );
    if (uncategorized.length > 0) {
      const uncatTotal = uncategorized.reduce((s, t) => s + t.amount, 0);
      lines.push(`⚠ UNCATEGORIZED (${uncategorized.length} tx — ${money(uncatTotal)})`);
      for (const tx of uncategorized) {
        const name = tx.counterparty_name || tx.label || "inconnu";
        const note = tx.categorizer_note || "";
        const date = (tx.date || "").slice(0, 10);
        lines.push([esc(`  ${name}`), "", money(tx.amount), date, note].join(","));
      }
      lines.push("");
    }

    // ═══════════════════════════════════════════
    // SECTION 2 — DÉTAIL DES TRANSACTIONS
    // ═══════════════════════════════════════════
    lines.push("");
    lines.push("═══ DÉTAIL DES TRANSACTIONS ═══");
    lines.push("");
    lines.push("Catégorie,Fournisseur,Montant (€),Date,Type");
    lines.push("");

    for (const section of SECTIONS) {
      let sectionHasTx = false;

      for (const item of section.items) {
        const key = `${section.key}|${item}`;
        const txs = details[key];
        if (!txs || txs.length === 0) continue;

        if (!sectionHasTx) {
          lines.push(section.header);
          sectionHasTx = true;
        }

        if (txs.length === 1) {
          lines.push(
            [esc(`  ${item}`), esc(txs[0].counterparty || "—"), money(txs[0].amount), txs[0].date, ""].join(",")
          );
        } else {
          const total = txs.reduce((s, t) => s + t.amount, 0);
          lines.push(
            [esc(`  ${item}`), `${txs.length} transactions`, money(total), "", ""].join(",")
          );
          for (const tx of txs.sort((a, b) => a.date.localeCompare(b.date))) {
            lines.push(
              [esc(`      ${tx.counterparty || "—"}`), "", money(tx.amount), tx.date, ""].join(",")
            );
          }
        }
      }

      if (sectionHasTx) lines.push("");
    }

    // Uncategorized detail
    if (uncategorized.length > 0) {
      lines.push("UNCATEGORIZED");
      for (const tx of uncategorized) {
        const name = tx.counterparty_name || tx.label || "inconnu";
        const date = (tx.date || "").slice(0, 10);
        const note = tx.categorizer_note || "";
        lines.push([esc(`  ${name}`), note, money(tx.amount), date, tx.operation_type || ""].join(","));
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
