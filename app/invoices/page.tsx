"use client";

import { useState, useEffect } from "react";

interface Client {
  id: string;
  name: string;
  legal_name: string;
  nif: string;
  email: string;
  city: string;
  payment_terms: number;
}

interface InvoiceItem {
  concept: string;
  quantity: number;
  unit_price: number;
}

interface Invoice {
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
  status: string;
  notes: string;
  recurring: string | null;
}

const IVA = 0.21;

function money(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2 });
}

export default function InvoicesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [view, setView] = useState<"list" | "create" | "client">("list");

  // Create invoice form
  const [selectedClient, setSelectedClient] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([{ concept: "", quantity: 1, unit_price: 0 }]);
  const [notes, setNotes] = useState("");
  const [recurring, setRecurring] = useState<string>("");
  const [irpfRate, setIrpfRate] = useState<number>(0);
  const [creating, setCreating] = useState(false);

  // Create client form
  const [newClient, setNewClient] = useState({
    name: "", legal_name: "", nif: "", email: "",
    address: "", city: "", postal_code: "", country: "España", payment_terms: 30,
  });

  useEffect(() => {
    fetch("/api/clients").then(r => r.json()).then(d => setClients(d.clients || []));
    fetch("/api/invoices").then(r => r.json()).then(d => setInvoices(d.invoices || []));
  }, []);

  async function handleCreateInvoice() {
    if (!selectedClient || items.some(i => !i.concept || i.unit_price <= 0)) return;
    setCreating(true);

    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: selectedClient,
        items,
        notes,
        recurring: recurring || null,
        irpf_rate: irpfRate,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setInvoices(prev => [data.invoice, ...prev]);
      setItems([{ concept: "", quantity: 1, unit_price: 0 }]);
      setNotes("");
      setRecurring("");
      setIrpfRate(0);
      setView("list");
    }
    setCreating(false);
  }

  async function handleCreateClient() {
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newClient),
    });
    if (res.ok) {
      const data = await res.json();
      setClients(prev => [...prev, data.client]);
      setNewClient({ name: "", legal_name: "", nif: "", email: "", address: "", city: "", postal_code: "", country: "España", payment_terms: 30 });
      setView("create");
    }
  }

  async function downloadPDF(invoice: Invoice) {
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pdf", invoice_id: invoice.id }),
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoice.number}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  }

  async function checkPayments() {
    const res = await fetch("/api/invoices/check-payments", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      // Refresh invoice list
      const listRes = await fetch("/api/invoices");
      const listData = await listRes.json();
      setInvoices(listData.invoices || []);
      if (data.matched > 0) {
        alert(`${data.matched} facture(s) marquée(s) comme payée(s)`);
      } else {
        alert("Aucun nouveau paiement détecté");
      }
    }
  }

  const base = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const iva = Math.round(base * IVA * 100) / 100;
  const irpf = Math.round(base * irpfRate * 100) / 100;
  const total = Math.round((base + iva - irpf) * 100) / 100;

  const inputClass = "bg-transparent border border-[#2A2A2E] text-white text-[14px] px-3 py-2.5 rounded-lg focus:outline-none focus:border-[#555] transition-colors duration-150 w-full";
  const labelClass = "text-[12px] text-[#6B7280] mb-1 block";

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-[60px] bg-[#0A0A0A] flex flex-col items-center py-6 fixed h-full z-10">
        <a href="/" className="w-8 h-8 bg-[#E5B73B] rounded-lg flex items-center justify-center mb-8">
          <span className="text-black font-bold text-sm">M</span>
        </a>
        <nav className="flex flex-col items-center gap-6 flex-1">
          <a href="/" className="p-2 rounded-lg hover:bg-[#1A1A1E] transition-colors duration-150" title="Dashboard">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
          </a>
          <a href="/invoices" className="p-2 rounded-lg hover:bg-[#1A1A1E] transition-colors duration-150 bg-[#1A1A1E]" title="Factures">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
          </a>
        </nav>
      </aside>

      {/* Main */}
      <div className="ml-[60px] flex-1 bg-[#111113] min-h-screen">
        <div className="max-w-[1000px] mx-auto px-8 py-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-[28px] font-bold text-white">Facturation</h1>
            <div className="flex gap-3">
              <button
                onClick={() => setView("create")}
                className={`text-[14px] px-4 py-2 rounded-[20px] transition-colors duration-150 cursor-pointer ${view === "create" ? "bg-white text-black" : "border border-[#333] text-white hover:bg-[#1E1E22]"}`}
              >
                + Nouvelle facture
              </button>
              <button
                onClick={() => setView("client")}
                className={`text-[14px] px-4 py-2 rounded-[20px] transition-colors duration-150 cursor-pointer ${view === "client" ? "bg-white text-black" : "border border-[#333] text-white hover:bg-[#1E1E22]"}`}
              >
                + Nouveau client
              </button>
              <button
                onClick={() => setView("list")}
                className={`text-[14px] px-4 py-2 rounded-[20px] transition-colors duration-150 cursor-pointer ${view === "list" ? "bg-white text-black" : "border border-[#333] text-white hover:bg-[#1E1E22]"}`}
              >
                Historique
              </button>
              <button
                onClick={checkPayments}
                className="text-[14px] px-4 py-2 rounded-[20px] border border-[#333] text-[#4ADE80] hover:bg-[#1E1E22] transition-colors duration-150 cursor-pointer"
              >
                Vérifier paiements Qonto
              </button>
            </div>
          </div>

          {/* ═══ CREATE INVOICE ═══ */}
          {view === "create" && (
            <div className="space-y-5">
              {/* Client select */}
              <div className="bg-[#1A1A1E] rounded-xl p-6">
                <h2 className="text-[14px] font-semibold text-white mb-4">Client</h2>
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className={`${inputClass} [color-scheme:dark]`}
                >
                  <option value="">Sélectionner un client...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name} — {c.nif}</option>
                  ))}
                </select>
                {!clients.length && (
                  <p className="text-[12px] text-[#6B7280] mt-2">
                    Aucun client. <button onClick={() => setView("client")} className="text-white underline cursor-pointer">Créer un client</button>
                  </p>
                )}
              </div>

              {/* Line items */}
              <div className="bg-[#1A1A1E] rounded-xl p-6">
                <h2 className="text-[14px] font-semibold text-white mb-4">Lignes de facture</h2>

                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_80px_120px_40px] gap-3 mb-3">
                    <div>
                      {idx === 0 && <label className={labelClass}>Concept</label>}
                      <input
                        type="text"
                        placeholder="Description du service..."
                        value={item.concept}
                        onChange={(e) => {
                          const copy = [...items];
                          copy[idx].concept = e.target.value;
                          setItems(copy);
                        }}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      {idx === 0 && <label className={labelClass}>Qté</label>}
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const copy = [...items];
                          copy[idx].quantity = parseInt(e.target.value) || 1;
                          setItems(copy);
                        }}
                        className={`${inputClass} text-center`}
                      />
                    </div>
                    <div>
                      {idx === 0 && <label className={labelClass}>Prix HT (€)</label>}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price || ""}
                        onChange={(e) => {
                          const copy = [...items];
                          copy[idx].unit_price = parseFloat(e.target.value) || 0;
                          setItems(copy);
                        }}
                        className={`${inputClass} text-right`}
                      />
                    </div>
                    <div className="flex items-end">
                      {items.length > 1 && (
                        <button
                          onClick={() => setItems(items.filter((_, i) => i !== idx))}
                          className="text-[#6B7280] hover:text-white p-2 transition-colors cursor-pointer"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => setItems([...items, { concept: "", quantity: 1, unit_price: 0 }])}
                  className="text-[12px] text-[#6B7280] hover:text-white transition-colors mt-2 cursor-pointer"
                >
                  + Ajouter une ligne
                </button>
              </div>

              {/* Options */}
              <div className="bg-[#1A1A1E] rounded-xl p-6">
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <label className={labelClass}>Récurrence</label>
                    <select
                      value={recurring}
                      onChange={(e) => setRecurring(e.target.value)}
                      className={`${inputClass} [color-scheme:dark]`}
                    >
                      <option value="">Ponctuelle</option>
                      <option value="monthly">Mensuelle</option>
                      <option value="quarterly">Trimestrielle</option>
                      <option value="yearly">Annuelle</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Retención IRPF</label>
                    <select
                      value={irpfRate}
                      onChange={(e) => setIrpfRate(parseFloat(e.target.value))}
                      className={`${inputClass} [color-scheme:dark]`}
                    >
                      <option value={0}>Sin retención</option>
                      <option value={0.07}>7% (inicio actividad)</option>
                      <option value={0.15}>15% (estándar)</option>
                      <option value={0.19}>19% (profesionales)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Notes</label>
                    <input
                      type="text"
                      placeholder="Notes optionnelles..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Totals + Submit */}
              <div className="bg-[#1A1A1E] rounded-xl p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <button
                      onClick={handleCreateInvoice}
                      disabled={creating || !selectedClient || items.some(i => !i.concept || i.unit_price <= 0)}
                      className="bg-white text-black text-[14px] font-semibold px-8 py-3 rounded-lg hover:bg-[#ddd] disabled:opacity-30 transition-colors duration-150 cursor-pointer"
                    >
                      {creating ? "Génération..." : "Générer la facture"}
                    </button>
                  </div>

                  <div className="text-right space-y-1 tabular-nums">
                    <div className="flex justify-between gap-8 text-[14px] text-[#9CA3AF]">
                      <span>Base imponible</span>
                      <span className="text-white">{money(base)} €</span>
                    </div>
                    <div className="flex justify-between gap-8 text-[14px] text-[#9CA3AF]">
                      <span>IVA 21%</span>
                      <span className="text-white">+{money(iva)} €</span>
                    </div>
                    {irpfRate > 0 && (
                      <div className="flex justify-between gap-8 text-[14px] text-[#9CA3AF]">
                        <span>Retención IRPF {Math.round(irpfRate * 100)}%</span>
                        <span className="text-[#F87171]">-{money(irpf)} €</span>
                      </div>
                    )}
                    <div className="border-t border-[#2A2A2E] pt-2 mt-2 flex justify-between gap-8 text-[18px] font-bold">
                      <span className="text-[#9CA3AF]">Total</span>
                      <span className="text-[#E5B73B]">{money(total)} €</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ CREATE CLIENT ═══ */}
          {view === "client" && (
            <div className="bg-[#1A1A1E] rounded-xl p-6 space-y-4">
              <h2 className="text-[14px] font-semibold text-white mb-2">Nouveau client</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Nom commercial</label>
                  <input type="text" placeholder="Acme Corp" value={newClient.name}
                    onChange={e => setNewClient({ ...newClient, name: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Raison sociale</label>
                  <input type="text" placeholder="ACME CORPORATION SL" value={newClient.legal_name}
                    onChange={e => setNewClient({ ...newClient, legal_name: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>NIF / CIF</label>
                  <input type="text" placeholder="B12345678" value={newClient.nif}
                    onChange={e => setNewClient({ ...newClient, nif: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Email</label>
                  <input type="email" placeholder="billing@acme.com" value={newClient.email}
                    onChange={e => setNewClient({ ...newClient, email: e.target.value })} className={inputClass} />
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Adresse</label>
                  <input type="text" placeholder="Calle Gran Via 1" value={newClient.address}
                    onChange={e => setNewClient({ ...newClient, address: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Ville</label>
                  <input type="text" placeholder="Barcelona" value={newClient.city}
                    onChange={e => setNewClient({ ...newClient, city: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Code postal</label>
                  <input type="text" placeholder="08001" value={newClient.postal_code}
                    onChange={e => setNewClient({ ...newClient, postal_code: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Pays</label>
                  <input type="text" value={newClient.country}
                    onChange={e => setNewClient({ ...newClient, country: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Délai de paiement (jours)</label>
                  <input type="number" value={newClient.payment_terms}
                    onChange={e => setNewClient({ ...newClient, payment_terms: parseInt(e.target.value) || 30 })} className={inputClass} />
                </div>
              </div>

              <button
                onClick={handleCreateClient}
                disabled={!newClient.name || !newClient.legal_name || !newClient.nif}
                className="bg-white text-black text-[14px] font-semibold px-6 py-2.5 rounded-lg hover:bg-[#ddd] disabled:opacity-30 transition-colors duration-150 mt-4 cursor-pointer"
              >
                Créer le client
              </button>
            </div>
          )}

          {/* ═══ INVOICE LIST ═══ */}
          {view === "list" && (
            <div className="bg-[#1A1A1E] rounded-xl">
              {invoices.length === 0 ? (
                <div className="p-12 text-center text-[14px] text-[#6B7280]">
                  Aucune facture. Crée ta première !
                </div>
              ) : (
                <div>
                  {/* Header */}
                  <div className="grid grid-cols-[140px_1fr_100px_120px_100px_80px] gap-4 px-6 py-3 text-[11px] tracking-wider uppercase text-[#6B7280] border-b border-[#2A2A2E]">
                    <span>N° Facture</span>
                    <span>Client</span>
                    <span>Date</span>
                    <span className="text-right">Total</span>
                    <span className="text-center">Statut</span>
                    <span></span>
                  </div>

                  {invoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="grid grid-cols-[140px_1fr_100px_120px_100px_80px] gap-4 px-6 py-4 items-center border-b border-[#1E1E22] hover:bg-[#252528] transition-colors duration-150"
                    >
                      <span className="text-[14px] text-white font-medium">{inv.number}</span>
                      <div>
                        <div className="text-[14px] text-white">{inv.client.name}</div>
                        <div className="text-[12px] text-[#6B7280]">{inv.client.nif}</div>
                      </div>
                      <span className="text-[13px] text-[#9CA3AF]">{inv.date}</span>
                      <span className="text-[14px] text-white text-right font-medium tabular-nums">{money(inv.total)} €</span>
                      <div className="text-center">
                        <span className={`text-[11px] px-2.5 py-1 rounded-full ${
                          inv.status === "paid" ? "bg-[#4ADE80]/10 text-[#4ADE80]" :
                          inv.status === "overdue" ? "bg-[#F87171]/10 text-[#F87171]" :
                          "bg-[#E5B73B]/10 text-[#E5B73B]"
                        }`}>
                          {inv.status === "paid" ? "Payée" : inv.status === "overdue" ? "En retard" : "Émise"}
                        </span>
                        {inv.recurring && (
                          <div className="text-[10px] text-[#6B7280] mt-1">{inv.recurring}</div>
                        )}
                      </div>
                      <button
                        onClick={() => downloadPDF(inv)}
                        className="text-[12px] text-[#6B7280] hover:text-white transition-colors cursor-pointer text-center"
                      >
                        PDF ↓
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
