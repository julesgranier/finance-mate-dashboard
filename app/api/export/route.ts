import { NextRequest } from "next/server";
import { getTransactions } from "@/lib/qonto";

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

    // Build CSV
    const csvHeaders = [
      "date",
      "side",
      "amount",
      "currency",
      "counterparty_name",
      "label",
      "operation_type",
      "reference",
      "note",
    ];
    const csvRows = transactions.map((tx) =>
      csvHeaders
        .map((h) => {
          const val = String(tx[h as keyof typeof tx] ?? "");
          // Escape CSV values
          if (val.includes(",") || val.includes('"') || val.includes("\n")) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        })
        .join(",")
    );
    const csv = [csvHeaders.join(","), ...csvRows].join("\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="finance_${monthParam}.csv"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
