import { NextRequest } from "next/server";
import { getInvoices, createInvoice, type InvoiceItem } from "@/lib/invoice-store";
import { generateInvoicePDF } from "@/lib/invoice-pdf";

export async function GET() {
  try {
    const invoices = await getInvoices();
    return Response.json({ invoices });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Generate PDF mode
  if (body.action === "pdf" && body.invoice_id) {
    try {
      const invoices = await getInvoices();
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return Response.json({ error: message }, { status: 500 });
    }
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

  try {
    const invoice = await createInvoice({
      client_id: body.client_id,
      items,
      notes: body.notes || "",
      recurring: body.recurring || null,
      irpf_rate: body.irpf_rate || 0,
    });

    if (!invoice) {
      return Response.json({ error: "Client not found" }, { status: 404 });
    }

    return Response.json({ invoice }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
