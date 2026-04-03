import { jsPDF } from "jspdf";
import { type Invoice, COMPANY } from "./invoice-store";

export function generateInvoicePDF(invoice: Invoice): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  let y = 20;

  // ── Company header ──
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text("MATE", 15, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(COMPANY.name, 15, y); y += 4;
  doc.text(`CIF: ${COMPANY.cif}`, 15, y); y += 4;
  doc.text(COMPANY.address, 15, y); y += 4;
  doc.text(COMPANY.city, 15, y); y += 4;

  // ── Invoice info (right side) ──
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text("FACTURA", w - 15, 22, { align: "right" });

  doc.setFontSize(14);
  doc.text(invoice.number, w - 15, 30, { align: "right" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Fecha: ${formatDate(invoice.date)}`, w - 15, 38, { align: "right" });
  doc.text(`Vencimiento: ${formatDate(invoice.due_date)}`, w - 15, 43, { align: "right" });

  if (invoice.recurring) {
    doc.text(`Recurrente: ${invoice.recurring}`, w - 15, 48, { align: "right" });
  }

  // ── Client block ──
  y += 4;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("FACTURAR A:", 15, y); y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text(invoice.client.legal_name || invoice.client.name, 15, y); y += 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`NIF/CIF: ${invoice.client.nif}`, 15, y); y += 4;
  doc.text(invoice.client.address, 15, y); y += 4;
  doc.text(`${invoice.client.postal_code} ${invoice.client.city}`, 15, y); y += 4;
  if (invoice.client.country) {
    doc.text(invoice.client.country, 15, y); y += 4;
  }

  y += 8;

  // ── Line items table ──
  // Header
  doc.setFillColor(30, 31, 54);
  doc.rect(15, y, w - 30, 8, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("Concepto", 18, y + 5.5);
  doc.text("Cant.", 115, y + 5.5, { align: "center" });
  doc.text("Precio Unit.", 150, y + 5.5, { align: "right" });
  doc.text("Total", w - 18, y + 5.5, { align: "right" });
  y += 10;

  // Rows
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);
  let stripe = false;

  for (const item of invoice.items) {
    if (stripe) {
      doc.setFillColor(248, 248, 250);
      doc.rect(15, y - 1, w - 30, 7, "F");
    }

    const lineTotal = item.quantity * item.unit_price;
    doc.setFontSize(9);
    doc.text(item.concept, 18, y + 3.5);
    doc.text(String(item.quantity), 115, y + 3.5, { align: "center" });
    doc.text(`${item.unit_price.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`, 150, y + 3.5, { align: "right" });
    doc.text(`${lineTotal.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`, w - 18, y + 3.5, { align: "right" });

    y += 7;
    stripe = !stripe;
  }

  y += 8;

  // ── Totals ──
  const xLabel = 130;
  const xVal = w - 18;

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text("Base imponible", xLabel, y, { align: "right" });
  doc.text(`${invoice.base.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`, xVal, y, { align: "right" });
  y += 5;

  doc.text(`IVA (${Math.round(invoice.iva_rate * 100)}%)`, xLabel, y, { align: "right" });
  doc.text(`${invoice.iva_amount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`, xVal, y, { align: "right" });
  y += 5;

  // IRPF (optional)
  if (invoice.irpf_rate > 0) {
    doc.text(`Retención IRPF (${Math.round(invoice.irpf_rate * 100)}%)`, xLabel, y, { align: "right" });
    doc.text(`-${invoice.irpf_amount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`, xVal, y, { align: "right" });
    y += 5;
  }

  // Line
  doc.setDrawColor(30, 31, 54);
  doc.line(xLabel - 15, y, xVal + 3, y);
  y += 5;

  // Total
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text("TOTAL", xLabel, y, { align: "right" });
  doc.text(`${invoice.total.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`, xVal, y, { align: "right" });

  // ── Footer ──
  y += 20;
  doc.setDrawColor(220, 220, 220);
  doc.line(15, y, w - 15, y);
  y += 5;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(140, 140, 140);

  if (invoice.notes) {
    doc.text(`Notas: ${invoice.notes}`, 15, y); y += 4;
  }

  doc.text(`Condiciones de pago: ${invoice.client.payment_terms || 30} días`, 15, y); y += 4;
  doc.text(`${COMPANY.name} | CIF: ${COMPANY.cif}`, 15, y); y += 4;
  doc.text(`${COMPANY.address}, ${COMPANY.city}`, 15, y);

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
