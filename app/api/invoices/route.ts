import { NextRequest } from "next/server";
import { getInvoices, createInvoice, type InvoiceItem } from "@/lib/invoice-store";
import { generateInvoicePDF } from "@/lib/invoice-pdf";

export async function GET() {
  return Response.json({ invoices: getInvoices() });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Generate PDF mode
  if (body.action === "pdf" && body.invoice_id) {
    const invoices = getInvoices();
    const invoice = invoices.find((i) => i.id === body.invoice_id);
    if (!invoice) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }
    const pdfBuffer = generateInvoicePDF(invoice);
    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.number}.pdf"`,
      },
    });
  }

  // Create invoice
  if (!body.client_id || !body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return Response.json({ error: "client_id and items[] required" }, { status: 400 });
  }

  const items: InvoiceItem[] = body.items.map((item: { concept: string; quantity?: number; unit_price: number }) => ({
    concept: item.concept || "",
    quantity: item.quantity || 1,
    unit_price: item.unit_price || 0,
  }));

  const invoice = createInvoice({
    client_id: body.client_id,
    items,
    notes: body.notes || "",
    recurring: body.recurring || null,
  });

  if (!invoice) {
    return Response.json({ error: "Client not found" }, { status: 404 });
  }

  // Auto-generate PDF and return invoice data
  return Response.json({ invoice }, { status: 201 });
}
