// In-memory store for invoices and clients (Vercel serverless)
// Data persists within the same serverless instance but resets on cold start.
// For production, swap with a database.

export interface Client {
  id: string;
  name: string;
  legal_name: string;
  nif: string;
  email: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  contact_person: string;
  payment_terms: number;
}

export interface InvoiceItem {
  concept: string;
  quantity: number;
  unit_price: number;
}

export interface Invoice {
  id: string;
  number: string;
  date: string;
  due_date: string;
  client: Client;
  items: InvoiceItem[];
  base: number;
  iva_rate: number;
  iva_amount: number;
  irpf_rate: number;
  irpf_amount: number;
  total: number;
  status: "draft" | "emitted" | "paid" | "overdue";
  notes: string;
  recurring: "monthly" | "quarterly" | "yearly" | null;
  created_at: string;
}

// Company info
export const COMPANY = {
  name: "YOUR MATES TECH SL",
  cif: "B56745144",
  address: "Carrer Aribau 254, Principal 1",
  city: "08006 Barcelona",
  country: "España",
  email: "hello@yourmates.tech",
};

export const IVA_RATE = 0.21;

// In-memory stores
let clients: Client[] = [
  {
    id: "client_001",
    name: "Acme Corp",
    legal_name: "ACME CORPORATION SL",
    nif: "B12345678",
    email: "billing@acme.com",
    address: "Calle Gran Via 1",
    city: "Barcelona",
    postal_code: "08001",
    country: "España",
    contact_person: "",
    payment_terms: 30,
  },
];

let invoices: Invoice[] = [];
let nextNumber = 1;

export function getClients(): Client[] {
  return clients;
}

export function getClient(id: string): Client | undefined {
  return clients.find((c) => c.id === id);
}

export function addClient(data: Omit<Client, "id">): Client {
  const id = `client_${String(clients.length + 1).padStart(3, "0")}`;
  const client = { ...data, id };
  clients.push(client);
  return client;
}

export function getInvoices(): Invoice[] {
  return invoices;
}

export function createInvoice(data: {
  client_id: string;
  items: InvoiceItem[];
  notes?: string;
  recurring?: "monthly" | "quarterly" | "yearly" | null;
  irpf_rate?: number;
}): Invoice | null {
  const client = getClient(data.client_id);
  if (!client) return null;

  const year = new Date().getFullYear();
  const number = `MATE-${year}-${String(nextNumber).padStart(3, "0")}`;
  nextNumber++;

  const now = new Date();
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + (client.payment_terms || 30));

  const base = data.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const iva_amount = Math.round(base * IVA_RATE * 100) / 100;
  const irpf_rate = data.irpf_rate || 0;
  const irpf_amount = Math.round(base * irpf_rate * 100) / 100;
  const total = Math.round((base + iva_amount - irpf_amount) * 100) / 100;

  const invoice: Invoice = {
    id: `inv_${Date.now()}`,
    number,
    date: now.toISOString().slice(0, 10),
    due_date: dueDate.toISOString().slice(0, 10),
    client,
    items: data.items,
    base,
    iva_rate: IVA_RATE,
    iva_amount,
    irpf_rate,
    irpf_amount,
    total,
    status: "emitted",
    notes: data.notes || "",
    recurring: data.recurring || null,
    created_at: now.toISOString(),
  };

  invoices.push(invoice);
  return invoice;
}
