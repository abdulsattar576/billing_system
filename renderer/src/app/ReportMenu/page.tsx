"use client";

import { useEffect, useState } from "react";
import { initDB } from "../services/db";

export default function ReportMenuPage() {
  const [db, setDb] = useState<any>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const [selectedArea, setSelectedArea] = useState("");
  const [personsInArea, setPersonsInArea] = useState<any[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [connectionQuery, setConnectionQuery] = useState("");
  const [connectionSuggestions, setConnectionSuggestions] = useState<any[]>([]);
  const [customerBalance, setCustomerBalance] = useState(0);

  useEffect(() => {
    const setup = async () => {
      const pouch = await initDB();
      if (!pouch) return;
      setDb(pouch);
      try {
        const a = await pouch.getAreas();
        setAreas(a || []);
      } catch (e) {
        console.warn("failed to load areas", e);
      }
      setLoading(false);
    };
    setup();
  }, []);

  // ----- helpers -----
  const getValidDate = (doc: any): Date => {
    if (doc.date) {
      const d = new Date(doc.date);
      if (!isNaN(d.getTime())) return d;
    }
    if (doc.createdAt) {
      const d = new Date(doc.createdAt);
      if (!isNaN(d.getTime())) return d;
    }
    // fallback: extract timestamp from _id (e.g., ..._1234567890123)
    const match = doc._id?.match(/\d{13}/);
    if (match) {
      const d = new Date(parseInt(match[0]));
      if (!isNaN(d.getTime())) return d;
    }
    return new Date(0);
  };

  const formatAmount = (amt: number) => `Rs. ${Math.abs(amt).toFixed(2)}`;
  const formatBalance = (bal: number) => {
    if (bal === 0) return "Rs. 0";
    if (bal < 0) return `- Rs. ${Math.abs(bal).toFixed(2)}`;
    return `Rs. ${bal.toFixed(2)}`;
  };

  // ----- load persons for area (with current balance) -----
  const loadAreaPersons = async (areaId: string) => {
    if (!db) return [];
    const persons = await db.getPersonsByArea(areaId);
    const withBalance = await Promise.all(
      persons.map(async (p: any) => ({
        ...p,
        balance: await db.calculateCustomerBalance(p._id),
      })),
    );
    return withBalance;
  };

  // ----- area change -----
  const onAreaChange = async (areaId: string) => {
    setSelectedArea(areaId);
    setSelectedPersonId("");
    setSelectedPerson(null);
    setTransactions([]);
    setFromDate("");
    setToDate("");
    setConnectionQuery("");
    setConnectionSuggestions([]);
    setCustomerBalance(0);
    if (areaId) {
      const areaPersons = await loadAreaPersons(areaId);
      setPersonsInArea(areaPersons);
    } else {
      setPersonsInArea([]);
    }
  };

  // ----- person selection -----
  const onPersonSelect = async (person: any) => {
    setSelectedPersonId(person._id);
    setSelectedPerson(person);
    setConnectionQuery(String(person.connectionNumber ?? ""));
    setConnectionSuggestions([]);
    setTransactions([]);
    setFromDate("");
    setToDate("");
    const bal = await db.calculateCustomerBalance(person._id);
    setCustomerBalance(bal);
  };

  // ----- connection search (type‑ahead) -----
  const onConnectionQueryChange = async (q: string) => {
    setConnectionQuery(q);
    setSelectedPersonId("");
    setSelectedPerson(null);
    setTransactions([]);
    setFromDate("");
    setToDate("");
    if (!q.trim()) {
      if (selectedArea) {
        const areaPersons = await loadAreaPersons(selectedArea);
        setPersonsInArea(areaPersons);
      }
      setConnectionSuggestions([]);
      return;
    }
    const qLower = q.toLowerCase();
    const filtered = personsInArea.filter(
      (p) =>
        String(p.connectionNumber).toLowerCase().includes(qLower) ||
        p.name.toLowerCase().includes(qLower),
    );
    setConnectionSuggestions(filtered.slice(0, 10));
  };

  // ----- load statement (core logic) -----
  const loadStatement = async () => {
    if (!db || !selectedPersonId) {
      alert("Please select a customer");
      return;
    }
    if (!fromDate || !toDate) {
      alert("Please select From Date and To Date");
      return;
    }
    if (fromDate > toDate) {
      alert("From Date cannot be later than To Date");
      return;
    }

    setLoading(true);
    try {
      // 1. Fetch all documents for this person
      const res = await db.localDB.allDocs({ include_docs: true });
      const allDocs = res.rows
        .map((r: any) => r.doc)
        .filter(
          (d: any) => d && !d._deleted && d.personId === selectedPersonId,
        );

      const relevantTypes = [
        "payment",
        "customer-debit",
        "credit-note",
        "debit-payment",
      ];
      const allTxns = allDocs.filter((d: any) =>
        relevantTypes.includes(d.type),
      );

      // 2. Compute running balance for ALL transactions (oldest → newest)
      const chronological = [...allTxns].sort(
        (a, b) => getValidDate(a).getTime() - getValidDate(b).getTime(),
      );
      let running = 0;
      const balanceMap = new Map(); // doc._id -> balance after that transaction
      for (const doc of chronological) {
        let delta = 0;
        if (doc.type === "payment" || doc.type === "debit-payment") {
          delta = Number(doc.amount || 0);
        } else if (doc.type === "customer-debit") {
          delta = -Number(doc.amount || 0);
        } else if (doc.type === "credit-note") {
          delta = Number(doc.amount || 0);
        }
        running += delta;
        balanceMap.set(doc._id, running);
      }

      // 3. Filter by date range (for display only)
      const startDate = new Date(fromDate);
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      const filteredTxns = allTxns.filter((doc: any) => {
        const docDate = getValidDate(doc);
        return docDate >= startDate && docDate <= endDate;
      });

      // 4. Sort filtered transactions newest first for display
      const newestFirst = [...filteredTxns].sort(
        (a, b) => getValidDate(b).getTime() - getValidDate(a).getTime(),
      );

      // 5. Build display rows
      const rows = newestFirst.map((doc: any) => {
        let sale = 0;
        let payment = 0;
        if (doc.type === "customer-debit") {
          sale = Number(doc.amount || 0);
        } else if (
          ["payment", "debit-payment", "credit-note"].includes(doc.type)
        ) {
          payment = Number(doc.amount || 0);
        }
        const dateObj = getValidDate(doc);
        const dateStr = dateObj.toISOString().slice(0, 10);
        const desc =
          doc.description ||
          (doc.type === "customer-debit" ? "Purchase" : "Payment");
        return {
          id: doc._id,
          date: dateStr,
          description: desc,
          sale,
          payment,
          balance: balanceMap.get(doc._id) || 0,
        };
      });

      setTransactions(rows);
      setCustomerBalance(running); // final balance after ALL transactions
    } catch (err: any) {
      console.error(err);
      alert("Failed to load statement: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ----- print statement -----
  const printStatement = () => {
    if (!selectedPerson) return;
    const printWindow = window.open("", "_blank", "width=1000,height=600");
    if (!printWindow) return;
    const areaName = areas.find((a) => a._id === selectedArea)?.name || "";
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Customer Statement</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { text-align: center; }
          .info { margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #f0f0f0; }
          .amount { text-align: right; }
        </style>
      </head>
      <body>
        <h1>Family Cable Network</h1>
        <div class="info">
          <p><strong>Customer:</strong> ${selectedPerson.name}</p>
          <p><strong>Connection #:</strong> ${selectedPerson.connectionNumber}</p>
          <p><strong>Area:</strong> ${areaName}</p>
          <p><strong>Address:</strong> ${selectedPerson.address || "-"}</p>
          <p><strong>Period:</strong> ${fromDate} to ${toDate}</p>
          <p><strong>Current Balance:</strong> ${formatBalance(customerBalance)}</p>
        </div>
        <table>
          <thead>
            <tr><th>Date</th><th>Description</th><th class="amount">Sale (Debit)</th><th class="amount">Payment (Credit)</th><th class="amount">Balance</th></tr>
          </thead>
          <tbody>
            ${transactions
              .map(
                (t) => `
              <tr>
                <td>${t.date}</td>
                <td>${t.description}</td>
                <td class="amount">${t.sale ? `- ${formatAmount(t.sale)}` : "-"}</td>
                <td class="amount">${t.payment ? `+ ${formatAmount(t.payment)}` : "-"}</td>
                <td class="amount">${formatBalance(t.balance)}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-black">Customer Statement</h1>
        <p className="text-sm text-gray-600">View transactions and balances</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Area
            </label>
            <select
              value={selectedArea}
              onChange={(e) => onAreaChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">-- Select Area --</option>
              {areas.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Connection No / Name
            </label>
            <div className="relative">
              <input
                type="text"
                value={connectionQuery}
                onChange={(e) => onConnectionQueryChange(e.target.value)}
                placeholder="Type connection # or name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
              {connectionSuggestions.length > 0 && (
                <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-auto">
                  {connectionSuggestions.map((p) => (
                    <li
                      key={p._id}
                      onClick={() => onPersonSelect(p)}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b"
                    >
                      #{p.connectionNumber} - {p.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {selectedPerson && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
            <div>
              <div className="text-xs text-gray-500">Customer Name</div>
              <div className="font-medium">{selectedPerson.name}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Connection</div>
              <div>{selectedPerson.connectionNumber}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Monthly Fee</div>
              <div>Rs.{Number(selectedPerson.amount).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Current Balance</div>
              <div
                className={
                  customerBalance < 0 ? "text-red-600" : "text-green-600"
                }
              >
                {formatBalance(customerBalance)}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={loadStatement}
            disabled={!selectedPersonId || !fromDate || !toDate}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Load Statement
          </button>
          {transactions.length > 0 && (
            <button
              onClick={printStatement}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Print Statement
            </button>
          )}
          <button
            onClick={() => {
              setSelectedPerson(null);
              setSelectedPersonId("");
              setConnectionQuery("");
              setTransactions([]);
              setFromDate("");
              setToDate("");
              setCustomerBalance(0);
              if (selectedArea) onAreaChange(selectedArea);
            }}
            className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500"
          >
            Clear
          </button>
        </div>
      </div>

      {selectedPerson ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h2 className="text-lg font-semibold">Transaction History</h2>
            {fromDate && toDate && (
              <p className="text-xs text-gray-500">
                {fromDate} to {toDate}
              </p>
            )}
          </div>
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              No transactions in selected period
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Description</th>
                    <th className="px-4 py-2 text-right">Sale (Debit)</th>
                    <th className="px-4 py-2 text-right">Payment (Credit)</th>
                    <th className="px-4 py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-4 py-2">{t.date}</td>
                      <td className="px-4 py-2">{t.description}</td>
                      <td className="px-4 py-2 text-right font-mono text-red-600">
                        {t.sale ? `- ${formatAmount(t.sale)}` : "-"}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-green-600">
                        {t.payment ? `+ ${formatAmount(t.payment)}` : "-"}
                      </td>
                      <td
                        className={`px-4 py-2 text-right font-mono ${
                          t.balance < 0 ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {formatBalance(t.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t">
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-2 text-right font-semibold"
                    >
                      Current Balance:
                    </td>
                    <td className="px-4 py-2 text-right font-bold">
                      {formatBalance(customerBalance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      ) : (
        selectedArea &&
        personsInArea.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">
              All Connections in{" "}
              {areas.find((a) => a._id === selectedArea)?.name}
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Connection #</th>
                    <th className="px-4 py-2 text-left">Customer Name</th>
                    <th className="px-4 py-2 text-left">Address</th>
                    <th className="px-4 py-2 text-right">Current Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {personsInArea.map((p) => (
                    <tr
                      key={p._id}
                      className="border-t cursor-pointer hover:bg-gray-50"
                      onClick={() => onPersonSelect(p)}
                    >
                      <td className="px-4 py-2">{p.connectionNumber}</td>
                      <td className="px-4 py-2">{p.name}</td>
                      <td className="px-4 py-2">{p.address || "-"}</td>
                      <td
                        className={`px-4 py-2 text-right font-mono ${
                          p.balance < 0 ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {formatBalance(p.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      <div className="mt-6 pt-4 border-t border-gray-300 text-xs text-gray-400">
        F1 - Date | F12 Back
      </div>
    </div>
  );
}
