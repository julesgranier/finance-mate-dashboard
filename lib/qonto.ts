const BASE_URL = "https://thirdparty.qonto.com/v2";
const LOGIN = process.env.QONTO_LOGIN!;
const SECRET_KEY = process.env.QONTO_SECRET_KEY!;

const headers = {
  Authorization: `${LOGIN}:${SECRET_KEY}`,
  "Content-Type": "application/json",
};

export interface Transaction {
  date: string;
  amount: number;
  amount_cents: number;
  currency: string;
  side: "credit" | "debit";
  operation_type: string;
  label: string;
  counterparty_name: string;
  attachment_ids: string[];
  reference: string;
  note: string;
}

export interface BankAccount {
  slug: string;
  iban: string;
  name: string;
  balance: number;
  balance_cents: number;
  currency: string;
  authorized_balance: number;
}

export async function getOrganization() {
  const res = await fetch(`${BASE_URL}/organization`, { headers });
  if (!res.ok) throw new Error(`Qonto API error: ${res.status}`);
  const data = await res.json();
  return data.organization;
}

export async function getBankAccounts(): Promise<BankAccount[]> {
  const org = await getOrganization();
  return org.bank_accounts;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export async function getTransactions(
  month: number,
  year: number
): Promise<Transaction[]> {
  const accounts = await getBankAccounts();
  if (!accounts.length) return [];

  const account = accounts[0];
  const lastDay = daysInMonth(year, month);
  const settledFrom = `${year}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`;
  const settledTo = `${year}-${String(month).padStart(2, "0")}-${lastDay}T23:59:59.999Z`;

  const allTransactions: Transaction[] = [];
  let page = 1;

  while (true) {
    const params = new URLSearchParams({
      slug: account.slug,
      iban: account.iban,
      settled_at_from: settledFrom,
      settled_at_to: settledTo,
      "status[]": "completed",
      current_page: String(page),
      per_page: "100",
    });

    const res = await fetch(`${BASE_URL}/transactions?${params}`, { headers });
    if (!res.ok) throw new Error(`Qonto API error: ${res.status}`);
    const data = await res.json();

    for (const tx of data.transactions || []) {
      allTransactions.push({
        date: tx.settled_at || tx.emitted_at || "",
        amount: tx.amount,
        amount_cents: tx.amount_cents,
        currency: tx.currency || "EUR",
        side: tx.side,
        operation_type: tx.operation_type,
        label: tx.label || "",
        counterparty_name: tx.counterparty_name || "",
        attachment_ids: tx.attachment_ids || [],
        reference: tx.reference || "",
        note: tx.note || "",
      });
    }

    const meta = data.meta || {};
    if (page >= (meta.total_pages || 1)) break;
    page++;
  }

  return allTransactions;
}
