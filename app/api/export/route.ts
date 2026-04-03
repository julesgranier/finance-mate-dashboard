import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { getTransactions } from "@/lib/qonto";
import {
  categorizeTransactions,
  aggregateActuals,
  aggregateDetails,
  SECTIONS,
  getBudget,
  type CategorizedTransaction,
} from "@/lib/categorizer";

function money(n: number): string {
  if (n === 0) return "-";
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`;
}

function pct(actual: number, budget: number): string {
  if (budget === 0) return actual > 0 ? "100%" : "-";
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

    const wb = XLSX.utils.book_new();

    // ═══════════════════════════════════════
    // SHEET 1 — SUMMARY
    // ═══════════════════════════════════════
    const summaryRows: (string | number)[][] = [];

    summaryRows.push([`MATE — FINANCE TRACKER ${monthParam}`]);
    summaryRows.push([]);
    summaryRows.push(["Catégorie", "Budget (€)", "Actual (€)", "Variance (€)", "% Utilisé"]);
    summaryRows.push([]);

    let totalBudget = 0;
    let totalActual = 0;

    for (const section of SECTIONS) {
      summaryRows.push([section.header]);
      let secBudget = 0;
      let secActual = 0;

      for (const item of section.items) {
        const b = getBudget(section.key, item);
        const key = `${section.key}|${item}`;
        const a = actuals[key] || 0;
        secBudget += b;
        secActual += a;
        summaryRows.push([`  ${item}`, money(b), money(a), money(b - a), pct(a, b)]);
      }

      summaryRows.push([section.total, money(secBudget), money(secActual), money(secBudget - secActual), pct(secActual, secBudget)]);
      summaryRows.push([]);
      totalBudget += secBudget;
      totalActual += secActual;
    }

    summaryRows.push(["TOTAL ALL COSTS", money(totalBudget), money(totalActual), money(totalBudget - totalActual), pct(totalActual, totalBudget)]);

    const uncategorized = categorized.filter(
      (t: CategorizedTransaction) => t.category === "UNCATEGORIZED" && t.side === "debit"
    );
    if (uncategorized.length > 0) {
      const uncatTotal = uncategorized.reduce((s: number, t: CategorizedTransaction) => s + t.amount, 0);
      summaryRows.push([]);
      summaryRows.push([`⚠ UNCATEGORIZED (${uncategorized.length} tx — ${money(uncatTotal)})`]);
      for (const tx of uncategorized) {
        summaryRows.push([`  ${tx.counterparty_name || tx.label || "inconnu"}`, "", money(tx.amount), (tx.date || "").slice(0, 10), tx.categorizer_note || ""]);
      }
    }

    const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
    ws1["!cols"] = [{ wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Summary");

    // ═══════════════════════════════════════
    // SHEET 2 — DÉTAIL
    // ═══════════════════════════════════════
    const detailRows: (string | number)[][] = [];

    detailRows.push([`DÉTAIL DES TRANSACTIONS — ${monthParam}`]);
    detailRows.push([]);
    detailRows.push(["Catégorie", "Fournisseur", "Montant (€)", "Date"]);
    detailRows.push([]);

    for (const section of SECTIONS) {
      let sectionHasTx = false;

      for (const item of section.items) {
        const key = `${section.key}|${item}`;
        const txs = details[key];
        if (!txs || txs.length === 0) continue;

        if (!sectionHasTx) {
          detailRows.push([section.header]);
          sectionHasTx = true;
        }

        // Sort by date
        const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));

        for (const tx of sorted) {
          detailRows.push([`  ${item}`, tx.name || "—", money(tx.amount), tx.date]);
        }
      }

      if (sectionHasTx) detailRows.push([]);
    }

    // Uncategorized detail
    if (uncategorized.length > 0) {
      detailRows.push(["⚠ UNCATEGORIZED"]);
      for (const tx of uncategorized) {
        const name = tx.counterparty_name || tx.label || "inconnu";
        const date = (tx.date || "").slice(0, 10);
        detailRows.push([`  ${tx.categorizer_note || "—"}`, name, money(tx.amount), date]);
      }
    }

    const ws2 = XLSX.utils.aoa_to_sheet(detailRows);
    ws2["!cols"] = [{ wch: 35 }, { wch: 30 }, { wch: 15 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Détail");

    // Generate buffer
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="finance_${monthParam}.xlsx"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
