"use client";

import { useState, useEffect, useCallback } from "react";

interface Transaction {
  date: string;
  amount: number;
  currency: string;
  side: "credit" | "debit";
  operation_type: string;
  label: string;
  counterparty_name: string;
}

interface AccountInfo {
  slug: string;
  iban: string;
  name: string;
  balance: number;
  currency: string;
  authorized_balance: number;
}

interface LogEntry {
  time: string;
  message: string;
  type: "info" | "success" | "error";
}

function ts() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMoney(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2 });
}

// ── Icons ──

function IconHome({ active }: { active?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#fff" : "#6B7280"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function IconTransactions({ active }: { active?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#fff" : "#6B7280"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  );
}

function IconExport({ active }: { active?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#fff" : "#6B7280"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconWarning() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B" stroke="none">
      <path d="M12 2L1 21h22L12 2zm0 4l7.53 13H4.47L12 6zm-1 5v4h2v-4h-2zm0 6v2h2v-2h-2z" />
    </svg>
  );
}

export default function Dashboard() {
  const [month, setMonth] = useState(currentMonth());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [stats, setStats] = useState({ count: 0, credit: 0, debit: 0, net: 0 });

  const log = useCallback((message: string, type: LogEntry["type"] = "info") => {
    setLogs((prev) => [...prev.slice(-19), { time: ts(), message, type }]);
  }, []);

  useEffect(() => {
    async function init() {
      log("Connexion à Qonto...");
      try {
        const res = await fetch("/api/organization");
        const data = await res.json();
        if (data.accounts) {
          setAccounts(data.accounts);
          log(`Connecté — ${data.accounts.length} compte(s)`, "success");
        } else {
          log(data.error || "Échec connexion", "error");
        }
      } catch {
        log("Échec connexion", "error");
      }
    }
    init();
  }, [log]);

  async function pull() {
    setLoading(true);
    log(`Pull ${month}...`);
    try {
      const res = await fetch(`/api/transactions?month=${month}`);
      const data = await res.json();
      if (data.error) {
        log(data.error, "error");
      } else {
        setTransactions(data.transactions);
        setStats({ count: data.count, credit: data.total_credit, debit: data.total_debit, net: data.net });
        log(`${data.count} transactions chargées`, "success");
      }
    } catch {
      log("Échec du pull", "error");
    }
    setLoading(false);
  }

  async function exportCSV() {
    setExporting(true);
    log(`Export ${month}...`);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      });
      if (!res.ok) {
        const err = await res.json();
        log(err.error, "error");
      } else {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `finance_${month}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        log(`finance_${month}.xlsx téléchargé`, "success");
      }
    } catch {
      log("Échec export", "error");
    }
    setExporting(false);
  }

  const connected = accounts.length > 0;
  const debits = transactions.filter((t) => t.side === "debit");
  const credits = transactions.filter((t) => t.side === "credit");

  return (
    <div className="flex min-h-screen">
      {/* ── Sidebar ── */}
      <aside className="w-[60px] bg-[#0A0A0A] flex flex-col items-center py-6 fixed h-full z-10">
        <div className="w-8 h-8 bg-[#E5B73B] rounded-lg flex items-center justify-center mb-8">
          <span className="text-black font-bold text-sm">M</span>
        </div>

        <nav className="flex flex-col items-center gap-6 flex-1">
          <button className="p-2 rounded-lg hover:bg-[#1A1A1E] transition-colors duration-150" title="Dashboard">
            <IconHome active />
          </button>
          <button className="p-2 rounded-lg hover:bg-[#1A1A1E] transition-colors duration-150" title="Transactions">
            <IconTransactions />
          </button>
          <button className="p-2 rounded-lg hover:bg-[#1A1A1E] transition-colors duration-150" title="Export">
            <IconExport />
          </button>
        </nav>

        <button className="p-2 rounded-lg hover:bg-[#1A1A1E] transition-colors duration-150 mb-2" title="Settings">
          <IconSettings />
        </button>
      </aside>

      {/* ── Main ── */}
      <div className="ml-[60px] flex-1 min-h-screen bg-[#111113]">
        <div className="max-w-[1200px] mx-auto px-8 py-8">

          {/* Title + Actions */}
          <div className="fade-in mb-8">
            <h1 className="text-[28px] font-bold text-white mb-5">Tableau de bord</h1>
            <div className="flex items-center gap-3">
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="bg-transparent border border-[#333] text-white text-[14px] px-4 py-2 rounded-[20px] focus:outline-none focus:border-[#555] transition-colors duration-150 [color-scheme:dark]"
              />
              <button
                onClick={pull}
                disabled={loading}
                className="border border-[#333] text-white text-[14px] px-4 py-2 rounded-[20px] hover:bg-[#1E1E22] disabled:opacity-30 transition-colors duration-150 cursor-pointer"
              >
                {loading ? "Chargement..." : "Pull transactions"}
              </button>
              <button
                onClick={exportCSV}
                disabled={exporting || transactions.length === 0}
                className="border border-[#333] text-white text-[14px] px-4 py-2 rounded-[20px] hover:bg-[#1E1E22] disabled:opacity-30 transition-colors duration-150 cursor-pointer"
              >
                {exporting ? "..." : "Export CSV"}
              </button>
            </div>
          </div>

          {/* ── 2-column Cards ── */}
          <div className="grid grid-cols-2 gap-5 mb-5 fade-in d1">
            {/* Solde */}
            <div className="bg-[#1A1A1E] rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[14px] font-semibold text-white">Solde</h2>
                <button className="text-[#6B7280] hover:text-white transition-colors duration-150">
                  <IconExport />
                </button>
              </div>

              <div className="text-[32px] font-bold text-[#E5B73B] tabular-nums mb-4">
                {connected ? `${formatMoney(accounts[0].balance)} €` : "—"}
              </div>

              {connected && (
                <div className="flex items-center gap-3 py-3 border-t border-[#2A2A2E]">
                  <div className="w-8 h-8 bg-[#2A2A2E] rounded-full flex items-center justify-center">
                    <span className="text-[10px] text-[#9CA3AF]">€</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-[14px] text-white">Cuenta principal</div>
                    <div className="text-[12px] text-[#6B7280]">{accounts[0].iban}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] text-white tabular-nums">
                      {formatMoney(accounts[0].balance)} €
                    </span>
                  </div>
                </div>
              )}

              {!connected && (
                <div className="text-[14px] text-[#6B7280]">Connexion en cours...</div>
              )}
            </div>

            {/* Transactions */}
            <div className="bg-[#1A1A1E] rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-[14px] font-semibold text-white">Transactions</h2>
                  <IconChevron />
                </div>
                {stats.count > 0 && (
                  <div className="flex items-center gap-4 text-[12px] tabular-nums">
                    <span className="text-[#4ADE80]">+{formatMoney(stats.credit)}</span>
                    <span className="text-[#F87171]">-{formatMoney(stats.debit)}</span>
                  </div>
                )}
              </div>

              {stats.count > 0 && (
                <div className="text-[14px] font-semibold text-white mb-3">
                  {stats.count} transaction{stats.count > 1 ? "s" : ""}
                </div>
              )}

              <div className="space-y-0.5 max-h-[240px] overflow-y-auto">
                {transactions.length === 0 ? (
                  <div className="py-8 text-center text-[14px] text-[#6B7280]">
                    Aucune transaction — sélectionne un mois et pull
                  </div>
                ) : (
                  transactions.slice(0, 20).map((tx, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg hover:bg-[#252528] transition-colors duration-150"
                    >
                      <div className="w-8 h-8 bg-[#2A2A2E] rounded-lg flex items-center justify-center shrink-0">
                        <span className="text-[10px] text-[#9CA3AF] uppercase">
                          {tx.operation_type?.slice(0, 2) || "tx"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] text-white truncate">
                          {tx.counterparty_name || tx.label || "—"}
                        </div>
                        <div className="text-[12px] text-[#6B7280]">
                          {tx.date?.slice(0, 10)}
                        </div>
                      </div>
                      <span className={`text-[14px] font-medium tabular-nums shrink-0 ${
                        tx.side === "credit" ? "text-[#4ADE80]" : "text-white"
                      }`}>
                        {tx.side === "credit" ? "+" : "-"}{formatMoney(tx.amount)} €
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ── Trésorerie ── */}
          {stats.count > 0 && (
            <div className="bg-[#1A1A1E] rounded-xl p-6 mb-5 fade-in d2">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-[14px] font-semibold text-white">Trésorerie</h2>
                  <span className="text-[12px] text-[#6B7280] border border-[#2A2A2E] rounded-full px-3 py-0.5 flex items-center gap-1">
                    {month} <IconChevron />
                  </span>
                </div>
              </div>

              <div className="flex items-baseline gap-3 mb-6">
                <span className={`text-[24px] font-bold tabular-nums ${stats.net >= 0 ? "text-white" : "text-[#F87171]"}`}>
                  {stats.net >= 0 ? "+" : ""}{formatMoney(stats.net)} €
                </span>
                <span className="text-[14px] text-[#6B7280]">Flux de trésorerie net</span>
              </div>

              {/* Mini bar chart */}
              <div className="flex items-end gap-1 h-24">
                {credits.length > 0 && (
                  <div className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-[#4ADE80] rounded-t-md min-h-[4px] transition-all duration-300"
                      style={{ height: `${Math.min((stats.credit / Math.max(stats.credit, stats.debit)) * 80, 80)}px` }}
                    />
                    <span className="text-[10px] text-[#6B7280]">IN</span>
                  </div>
                )}
                {debits.length > 0 && (
                  <div className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-[#F87171] rounded-t-md min-h-[4px] transition-all duration-300"
                      style={{ height: `${Math.min((stats.debit / Math.max(stats.credit, stats.debit)) * 80, 80)}px` }}
                    />
                    <span className="text-[10px] text-[#6B7280]">OUT</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Log ── */}
          <div className="bg-[#1A1A1E] rounded-xl p-6 fade-in d3">
            <h2 className="text-[14px] font-semibold text-white mb-3">Système</h2>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {logs.map((entry, i) => (
                <div key={i} className="flex items-start gap-2 text-[12px]">
                  <span className="text-[#333] shrink-0 tabular-nums">{entry.time}</span>
                  <span className={
                    entry.type === "error"
                      ? "text-[#F87171]"
                      : entry.type === "success"
                        ? "text-[#4ADE80]"
                        : "text-[#6B7280]"
                  }>
                    {entry.message}
                  </span>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-[12px] text-[#333]">En attente...</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
