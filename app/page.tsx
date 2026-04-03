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

export default function Dashboard() {
  const [month, setMonth] = useState(currentMonth());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [stats, setStats] = useState({ count: 0, credit: 0, debit: 0, net: 0 });

  const log = useCallback((message: string, type: LogEntry["type"] = "info") => {
    setLogs((prev) => [...prev.slice(-29), { time: ts(), message, type }]);
  }, []);

  useEffect(() => {
    async function init() {
      log("connecting...");
      try {
        const res = await fetch("/api/organization");
        const data = await res.json();
        if (data.accounts) {
          setAccounts(data.accounts);
          log(`connected — ${data.accounts.length} account(s)`, "success");
        } else {
          log(data.error || "connection failed", "error");
        }
      } catch {
        log("connection failed", "error");
      }
    }
    init();
  }, [log]);

  async function pull() {
    setLoading(true);
    log(`pull ${month}`);
    try {
      const res = await fetch(`/api/transactions?month=${month}`);
      const data = await res.json();
      if (data.error) {
        log(data.error, "error");
      } else {
        setTransactions(data.transactions);
        setStats({
          count: data.count,
          credit: data.total_credit,
          debit: data.total_debit,
          net: data.net,
        });
        log(`${data.count} transactions — net ${data.net >= 0 ? "+" : ""}${data.net.toFixed(2)}`, "success");
      }
    } catch {
      log("fetch failed", "error");
    }
    setLoading(false);
  }

  async function exportCSV() {
    setExporting(true);
    log(`export ${month}`);
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
        a.download = `finance_${month}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        log(`saved finance_${month}.csv`, "success");
      }
    } catch {
      log("export failed", "error");
    }
    setExporting(false);
  }

  const connected = accounts.length > 0;

  return (
    <div className="min-h-screen bg-black text-white font-mono">
      {/* ── Top bar ── */}
      <div className="border-b border-[#1a1a1a] fade-in">
        <div className="max-w-[1400px] mx-auto px-8 py-6 flex items-end justify-between">
          <div>
            <h1 className="text-[11px] font-light tracking-[0.5em] uppercase text-[#666]">
              Finance Mate
            </h1>
            <div className="text-[40px] font-light tracking-tight leading-none mt-1 tabular-nums">
              {connected
                ? `${accounts[0].balance.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} EUR`
                : "—"}
            </div>
          </div>
          <div className="text-right text-[10px] tracking-[0.15em] uppercase text-[#444] space-y-1">
            <div>{connected ? accounts[0].iban : ""}</div>
            <div>{connected ? "CONNECTED" : "OFFLINE"}</div>
          </div>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="border-b border-[#1a1a1a] fade-in d1">
        <div className="max-w-[1400px] mx-auto px-8 py-5 flex items-center gap-6">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-transparent border border-[#222] text-white text-[13px] px-4 py-2.5 font-mono tracking-wide focus:outline-none focus:border-[#555] transition-colors [color-scheme:dark] w-52"
          />
          <button
            onClick={pull}
            disabled={loading}
            className="bg-white text-black text-[11px] font-medium tracking-[0.2em] uppercase px-8 py-2.5 hover:bg-[#ccc] disabled:opacity-20 transition-all cursor-pointer"
          >
            {loading ? "..." : "PULL"}
          </button>
          <button
            onClick={exportCSV}
            disabled={exporting || transactions.length === 0}
            className="border border-[#333] text-[#666] text-[11px] font-medium tracking-[0.2em] uppercase px-8 py-2.5 hover:border-white hover:text-white disabled:opacity-20 transition-all cursor-pointer"
          >
            {exporting ? "..." : "EXPORT CSV"}
          </button>

          {stats.count > 0 && (
            <div className="ml-auto flex gap-10 text-[12px] tabular-nums">
              <div>
                <span className="text-[#444] mr-3">IN</span>
                <span className="text-white">+{stats.credit.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[#444] mr-3">OUT</span>
                <span className="text-[#888]">-{stats.debit.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-[#444] mr-3">NET</span>
                <span className="text-white font-medium">
                  {stats.net >= 0 ? "+" : ""}{stats.net.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto flex">
        {/* ── Table ── */}
        <main className="flex-1 fade-in d2">
          {transactions.length === 0 ? (
            <div className="px-8 py-32 text-center">
              <div className="text-[#1a1a1a] text-[120px] font-thin leading-none select-none">
                /
              </div>
              <div className="text-[11px] text-[#333] tracking-[0.3em] uppercase mt-6">
                No data — select period and pull
              </div>
            </div>
          ) : (
            <div>
              {/* Table head */}
              <div className="grid grid-cols-[100px_60px_120px_1fr_1fr_90px] gap-3 px-8 py-3 text-[9px] tracking-[0.25em] uppercase text-[#444] border-b border-[#111]">
                <span>Date</span>
                <span>Dir</span>
                <span className="text-right">Amount</span>
                <span>Counterparty</span>
                <span>Label</span>
                <span>Type</span>
              </div>

              {/* Rows */}
              {transactions.map((tx, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[100px_60px_120px_1fr_1fr_90px] gap-3 px-8 py-3 text-[12px] border-b border-[#0a0a0a] hover:bg-[#060606] transition-colors group"
                >
                  <span className="text-[#555] tabular-nums">
                    {tx.date?.slice(0, 10)}
                  </span>
                  <span className={`text-[10px] uppercase tracking-[0.2em] ${tx.side === "credit" ? "text-white" : "text-[#444]"}`}>
                    {tx.side === "credit" ? "IN" : "OUT"}
                  </span>
                  <span className={`text-right tabular-nums ${tx.side === "credit" ? "text-white" : "text-[#666]"}`}>
                    {tx.side === "credit" ? "+" : "-"}{tx.amount.toFixed(2)}
                  </span>
                  <span className="text-[#777] truncate group-hover:text-white transition-colors">
                    {tx.counterparty_name || "—"}
                  </span>
                  <span className="text-[#444] truncate">
                    {tx.label || "—"}
                  </span>
                  <span className="text-[9px] text-[#333] uppercase tracking-[0.15em]">
                    {tx.operation_type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* ── Log ── */}
        <aside className="w-72 border-l border-[#0d0d0d] fade-in d3">
          <div className="px-6 py-3 text-[9px] tracking-[0.25em] uppercase text-[#333] border-b border-[#0d0d0d]">
            Log
          </div>
          <div className="px-6 py-4 space-y-1.5 text-[10px] leading-relaxed max-h-[calc(100vh-220px)] overflow-y-auto">
            {logs.map((entry, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-[#222] shrink-0">{entry.time}</span>
                <span className={
                  entry.type === "error"
                    ? "text-[#666]"
                    : entry.type === "success"
                      ? "text-[#999]"
                      : "text-[#444]"
                }>
                  {entry.message}
                </span>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="text-[#222]">waiting</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
