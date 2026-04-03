import { NextRequest } from "next/server";
import { getTransactions } from "@/lib/qonto";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const monthParam = searchParams.get("month");

  if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
    return Response.json(
      { error: "Parameter 'month' required in YYYY-MM format" },
      { status: 400 }
    );
  }

  const [year, month] = monthParam.split("-").map(Number);

  try {
    const transactions = await getTransactions(month, year);
    const totalCredit = transactions
      .filter((t) => t.side === "credit")
      .reduce((sum, t) => sum + t.amount, 0);
    const totalDebit = transactions
      .filter((t) => t.side === "debit")
      .reduce((sum, t) => sum + t.amount, 0);

    return Response.json({
      month: monthParam,
      count: transactions.length,
      total_credit: totalCredit,
      total_debit: totalDebit,
      net: totalCredit - totalDebit,
      transactions,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
