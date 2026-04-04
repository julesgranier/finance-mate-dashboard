import { supabase } from "./supabase";

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
  client_id: string;
  client?: Client;
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

export const COMPANY = {
  name: "YOUR MATES TECH SL",
  cif: "B56745144",
  address: "Carrer Aribau 254, Principal 1",
  city: "08006 Barcelona",
  country: "España",
  email: "hello@yourmates.tech",
};

export const IVA_RATE = 0.21;

// ── Clients ──

export async function getClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getClient(id: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}

export async function addClient(data: Omit<Client, "id">): Promise<Client> {
  const { data: client, error } = await supabase
    .from("clients")
    .insert(data)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return client;
}

// ── Invoices ──

export async function getInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  // Attach client info
  const clients = await getClients();
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]));

  return (data || []).map((inv) => ({
    ...inv,
    client: clientMap[inv.client_id] || null,
  }));
}

export async function updateInvoiceStatus(id: string, status: string): Promise<void> {
  await supabase.from("invoices").update({ status }).eq("id", id);
}

export async function createInvoice(data: {
  client_id: string;
  items: InvoiceItem[];
  notes?: string;
  recurring?: "monthly" | "quarterly" | "yearly" | null;
  irpf_rate?: number;
}): Promise<Invoice | null> {
  const client = await getClient(data.client_id);
  if (!client) return null;

  // Get and increment counter
  const { data: counter } = await supabase
    .from("invoice_counter")
    .select("next_number")
    .eq("id", 1)
    .single();

  const num = counter?.next_number || 1;
  const year = new Date().getFullYear();
  const number = `MATE-${year}-${String(num).padStart(3, "0")}`;

  await supabase
    .from("invoice_counter")
    .update({ next_number: num + 1 })
    .eq("id", 1);

  const now = new Date();
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + (client.payment_terms || 30));

  const base = data.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const iva_amount = Math.round(base * IVA_RATE * 100) / 100;
  const irpf_rate = data.irpf_rate || 0;
  const irpf_amount = Math.round(base * irpf_rate * 100) / 100;
  const total = Math.round((base + iva_amount - irpf_amount) * 100) / 100;

  const invoiceData = {
    number,
    date: now.toISOString().slice(0, 10),
    due_date: dueDate.toISOString().slice(0, 10),
    client_id: data.client_id,
    items: data.items,
    base,
    iva_rate: IVA_RATE,
    iva_amount,
    irpf_rate,
    irpf_amount,
    total,
    status: "emitted" as const,
    notes: data.notes || "",
    recurring: data.recurring || null,
  };

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert(invoiceData)
    .select()
    .single();

  if (error) throw new Error(error.message);

  return { ...invoice, client };
}
