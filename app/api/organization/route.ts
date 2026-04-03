import { getBankAccounts } from "@/lib/qonto";

export async function GET() {
  try {
    const accounts = await getBankAccounts();
    return Response.json({ accounts });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
