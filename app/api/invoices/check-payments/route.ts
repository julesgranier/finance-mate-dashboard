import { getInvoices, updateInvoiceStatus, getClient } from "@/lib/invoice-store";
import { getTransactions } from "@/lib/qonto";

export async function POST() {
  try {
    const invoices = await getInvoices();
    const emitted = invoices.filter((inv) => inv.status === "emitted");

    if (emitted.length === 0) {
      return Response.json({ matched: 0, results: [] });
    }

    // Get credits from last 3 months
    const now = new Date();
    const allCredits: { date: string; amount: number; label: string; counterparty: string }[] = [];

    for (let i = 0; i < 3; i++) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      try {
        const txs = await getTransactions(d.getMonth() + 1, d.getFullYear());
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
        // skip
      }
    }

    let matched = 0;
    const results: { invoice_id: string; invoice_number: string; matched: boolean }[] = [];

    for (const inv of emitted) {
      const client = inv.client || (inv.client_id ? await getClient(inv.client_id) : null);
      if (!client) continue;

      const clientName = client.name.toLowerCase();
      const clientLegal = (client.legal_name || "").toLowerCase();

      const match = allCredits.find((credit) => {
        const amountMatch =
          Math.abs(credit.amount - inv.total) < 0.02 ||
          Math.abs(credit.amount - inv.base) < 0.02 ||
          Math.abs(credit.amount - (inv.base + inv.iva_amount)) < 0.02;
        if (!amountMatch) return false;

        const text = `${credit.label} ${credit.counterparty}`;
        return (
          text.includes(clientName) ||
          text.includes(clientLegal) ||
          clientName.split(" ").some((w) => w.length > 3 && text.includes(w))
        );
      });

      if (match) {
        await updateInvoiceStatus(inv.id, "paid");
        matched++;
        results.push({ invoice_id: inv.id, invoice_number: inv.number, matched: true });
      } else {
        const dueDate = new Date(inv.due_date);
        if (now > dueDate) {
          await updateInvoiceStatus(inv.id, "overdue");
        }
        results.push({ invoice_id: inv.id, invoice_number: inv.number, matched: false });
      }
    }

    return Response.json({ matched, total: emitted.length, results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
