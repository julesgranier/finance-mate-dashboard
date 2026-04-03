import { getInvoices } from "@/lib/invoice-store";
import { getTransactions } from "@/lib/qonto";

export async function POST() {
  const invoices = getInvoices();
  const emitted = invoices.filter((inv) => inv.status === "emitted");

  if (emitted.length === 0) {
    return Response.json({ matched: 0, results: [] });
  }

  // Get all credit transactions from the last 3 months
  const now = new Date();
  const results: { invoice_id: string; invoice_number: string; matched: boolean; transaction_date?: string }[] = [];

  // Collect credits from last 3 months
  const allCredits: { date: string; amount: number; label: string; counterparty: string }[] = [];

  for (let i = 0; i < 3; i++) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    const month = d.getMonth() + 1;
    const year = d.getFullYear();

    try {
      const txs = await getTransactions(month, year);
      for (const tx of txs) {
        if (tx.side === "credit") {
          allCredits.push({
            date: (tx.date || "").slice(0, 10),
            amount: tx.amount,
            label: (tx.label || "").toLowerCase(),
            counterparty: (tx.counterparty_name || "").toLowerCase(),
          });
        }
      }
    } catch {
      // Skip months that fail
    }
  }

  let matched = 0;

  for (const inv of emitted) {
    // Match by amount (exact or total) and client name
    const clientName = inv.client.name.toLowerCase();
    const clientLegal = (inv.client.legal_name || "").toLowerCase();

    const match = allCredits.find((credit) => {
      // Amount must match (base or total, accounting for IRPF)
      const amountMatch =
        Math.abs(credit.amount - inv.total) < 0.02 ||
        Math.abs(credit.amount - inv.base) < 0.02 ||
        Math.abs(credit.amount - (inv.base + inv.iva_amount)) < 0.02;

      if (!amountMatch) return false;

      // Try to match client name in credit label or counterparty
      const text = `${credit.label} ${credit.counterparty}`;
      const nameMatch =
        text.includes(clientName) ||
        text.includes(clientLegal) ||
        clientName.split(" ").some((word) => word.length > 3 && text.includes(word));

      return nameMatch;
    });

    if (match) {
      inv.status = "paid";
      matched++;
      results.push({
        invoice_id: inv.id,
        invoice_number: inv.number,
        matched: true,
        transaction_date: match.date,
      });
    } else {
      // Check if overdue
      const dueDate = new Date(inv.due_date);
      if (now > dueDate) {
        inv.status = "overdue";
      }
      results.push({
        invoice_id: inv.id,
        invoice_number: inv.number,
        matched: false,
      });
    }
  }

  return Response.json({ matched, total: emitted.length, results });
}
