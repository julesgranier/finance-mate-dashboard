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

function now() {
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
  const [stats, setStats] = useState({
    count: 0,
    credit: 0,
    debit: 0,
    net: 0,
  });

  const addLog = useCallback(
    (message: string, type: LogEntry["type"] = "info") => {
      setLogs((prev) => [...prev.slice(-19), { time: now(), message, type }]);
    },
    []
  );

  useEffect(() => {
    async function fetchOrg() {
      try {
        addLog("SYS > Connecting to Qonto API...");
        const res = await fetch("/api/organization");
        const data = await res.json();
        if (data.accounts) {
          setAccounts(data.accounts);
          addLog(
            `SYS > Connected. ${data.accounts.length} account(s) found.`,
            "success"
          );
        } else {
          addLog(`ERR > ${data.error || "Failed to connect"}`, "error");
        }
      } catch {
        addLog("ERR > Connection failed", "error");
      }
    }
    fetchOrg();
  }, [addLog]);

  async function fetchTransactions() {
    setLoading(true);
    addLog(`CMD > GET /transactions?month=${month}`);
    try {
      const res = await fetch(`/api/transactions?month=${month}`);
      const data = await res.json();
      if (data.error) {
        addLog(`ERR > ${data.error}`, "error");
      } else {
        setTransactions(data.transactions);
        setStats({
          count: data.count,
          credit: data.total_credit,
          debit: data.total_debit,
          net: data.net,
        });
        addLog(
          `RES > ${data.count} transactions loaded. Net: ${data.net >= 0 ? "+" : ""}${data.net.toFixed(2)} EUR`,
          "success"
        );
      }
    } catch {
      addLog("ERR > Failed to fetch transactions", "error");
    }
    setLoading(false);
  }

  async function handleExport() {
    setExporting(true);
    addLog(`CMD > POST /export { month: "${month}" }`);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      });
      if (!res.ok) {
        const err = await res.json();
        addLog(`ERR > ${err.error}`, "error");
      } else {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `finance_${month}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        addLog(`RES > CSV exported: finance_${month}.csv`, "success");
      }
    } catch {
      addLog("ERR > Export failed", "error");
    }
    setExporting(false);
  }

  return (
    <div className="min-h-screen bg-[#000] text-[#e0e0e0] font-mono">
      {/* Header */}
      <header className="border-b border-[#1a1a1a] px-6 py-4 animate-fade-up">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-bold tracking-[0.3em] text-white uppercase">
              Finance Mate
            </h1>
            <span className="text-[10px] text-[#444] tracking-widest">
              TERMINAL v1.0
            </span>
          </div>
          <div className="flex items-center gap-6 text-[11px] text-[#555]">
            <span>
              {accounts.length > 0 ? (
                <span className="text-[#00ff88]">● CONNECTED</span>
              ) : (
                <span className="text-[#ff3333]">● OFFLINE</span>
              )}
            </span>
            <span className="tabular-nums">{now()}</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Left Panel */}
        <aside className="w-80 border-r border-[#1a1a1a] flex flex-col">
          {/* Account Info */}
          <div className="p-6 border-b border-[#1a1a1a] animate-fade-up delay-1">
            <div className="text-[10px] tracking-[0.2em] text-[#555] mb-3 uppercase">
              Account
            </div>
            {accounts.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xl font-light text-white tabular-nums">
                  {accounts[0].balance.toLocaleString("fr-FR", {
                    minimumFractionDigits: 2,
                  })}{" "}
                  <span className="text-[11px] text-[#555]">
                    {accounts[0].currency}
                  </span>
                </div>
                <div className="text-[11px] text-[#444] font-light tracking-wide">
                  {accounts[0].iban}
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-[#444]">Loading...</div>
            )}
          </div>

          {/* Month Selector */}
          <div className="p-6 border-b border-[#1a1a1a] animate-fade-up delay-2">
            <div className="text-[10px] tracking-[0.2em] text-[#555] mb-3 uppercase">
              Period
            </div>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#222] text-white text-sm px-3 py-2 font-mono focus:outline-none focus:border-[#444] transition-colors [color-scheme:dark]"
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={fetchTransactions}
                disabled={loading}
                className="flex-1 bg-white text-black text-[11px] font-semibold tracking-[0.15em] uppercase py-2.5 px-4 hover:bg-[#ddd] disabled:opacity-30 transition-all cursor-pointer"
              >
                {loading ? "LOADING..." : "PULL"}
              </button>
              <button
                onClick={handleExport}
                disabled={exporting || transactions.length === 0}
                className="flex-1 border border-[#333] text-[#888] text-[11px] font-semibold tracking-[0.15em] uppercase py-2.5 px-4 hover:border-white hover:text-white disabled:opacity-20 transition-all cursor-pointer"
              >
                {exporting ? "..." : "EXPORT CSV"}
              </button>
            </div>
          </div>

          {/* Stats */}
          {stats.count > 0 && (
            <div className="p-6 border-b border-[#1a1a1a] animate-fade-up">
              <div className="text-[10px] tracking-[0.2em] text-[#555] mb-3 uppercase">
                Summary — {month}
              </div>
              <div className="space-y-2 text-[12px] tabular-nums">
                <div className="flex justify-between">
                  <span className="text-[#555]">Transactions</span>
                  <span className="text-white">{stats.count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#555]">Credits</span>
                  <span className="text-[#00ff88]">
                    +{stats.credit.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#555]">Debits</span>
                  <span className="text-[#ff3333]">
                    -{stats.debit.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#1a1a1a]">
                  <span className="text-[#555]">Net</span>
                  <span
                    className={`font-medium ${stats.net >= 0 ? "text-[#00ff88]" : "text-[#ff3333]"}`}
                  >
                    {stats.net >= 0 ? "+" : ""}
                    {stats.net.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Log */}
          <div className="flex-1 p-6 animate-fade-up delay-3">
            <div className="text-[10px] tracking-[0.2em] text-[#555] mb-3 uppercase">
              System Log
            </div>
            <div className="space-y-1 text-[10px] leading-relaxed max-h-60 overflow-y-auto">
              {logs.map((log, i) => (
                <div
                  key={i}
                  className={`font-light ${
                    log.type === "error"
                      ? "text-[#ff3333]"
                      : log.type === "success"
                        ? "text-[#00ff88]"
                        : "text-[#555]"
                  }`}
                >
                  <span className="text-[#333] mr-2">{log.time}</span>
                  {log.message}
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-[#333]">Waiting for input...</div>
              )}
              <div className="cursor-blink text-[#333] mt-1 text-[9px]">
                ready
              </div>
            </div>
          </div>
        </aside>

        {/* Main — Transactions Table */}
        <main className="flex-1 flex flex-col animate-fade-up delay-4">
          <div className="px-6 py-4 border-b border-[#1a1a1a]">
            <div className="text-[10px] tracking-[0.2em] text-[#555] uppercase">
              Transactions — {month}
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-[#222] text-6xl font-thin mb-4">—</div>
                <div className="text-[11px] text-[#333] tracking-wide">
                  Select a period and press PULL
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <div className="grid grid-cols-[100px_70px_110px_1fr_1fr_100px] gap-4 px-6 py-3 text-[10px] tracking-[0.15em] text-[#444] uppercase border-b border-[#111] sticky top-0 bg-[#000]">
                <span>Date</span>
                <span>Side</span>
                <span className="text-right">Amount</span>
                <span>Counterparty</span>
                <span>Label</span>
                <span>Type</span>
              </div>

              {transactions.map((tx, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[100px_70px_110px_1fr_1fr_100px] gap-4 px-6 py-2.5 text-[12px] border-b border-[#0d0d0d] hover:bg-[#080808] transition-colors group"
                >
                  <span className="text-[#555] tabular-nums">
                    {tx.date?.slice(0, 10)}
                  </span>
                  <span
                    className={`text-[10px] uppercase tracking-wider font-medium ${tx.side === "credit" ? "text-[#00ff88]" : "text-[#ff3333]"}`}
                  >
                    {tx.side === "credit" ? "IN" : "OUT"}
                  </span>
                  <span
                    className={`text-right tabular-nums font-medium ${tx.side === "credit" ? "text-[#e0e0e0]" : "text-[#888]"}`}
                  >
                    {tx.side === "credit" ? "+" : "-"}
                    {tx.amount.toFixed(2)}
                  </span>
                  <span className="text-[#999] truncate group-hover:text-white transition-colors">
                    {tx.counterparty_name || "—"}
                  </span>
                  <span className="text-[#555] truncate">
                    {tx.label || "—"}
                  </span>
                  <span className="text-[10px] text-[#333] uppercase tracking-wider">
                    {tx.operation_type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
