import { NextRequest } from "next/server";
import { getClients, addClient } from "@/lib/invoice-store";

export async function GET() {
  return Response.json({ clients: getClients() });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const required = ["name", "legal_name", "nif", "address", "city", "postal_code"];
  for (const field of required) {
    if (!body[field]) {
      return Response.json({ error: `Missing field: ${field}` }, { status: 400 });
    }
  }

  const client = addClient({
    name: body.name,
    legal_name: body.legal_name,
    nif: body.nif,
    email: body.email || "",
    address: body.address,
    city: body.city,
    postal_code: body.postal_code,
    country: body.country || "España",
    contact_person: body.contact_person || "",
    payment_terms: body.payment_terms || 30,
  });

  return Response.json({ client }, { status: 201 });
}
