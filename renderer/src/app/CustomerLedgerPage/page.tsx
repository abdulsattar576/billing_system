"use client";

import { useEffect, useState } from "react";
import { initDB } from "../services/db";

export default function CustomerLedgerPage() {
  const [db, setDb] = useState<any>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const [selectedArea, setSelectedArea] = useState("");
  const [personsInArea, setPersonsInArea] = useState<any[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [connectionQuery, setConnectionQuery] = useState("");
  const [connectionSuggestions, setConnectionSuggestions] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [customerBalance, setCustomerBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const setup = async () => {
      const pouch = await initDB();
      if (!pouch) return;
      setDb(pouch);
      const areaList = await pouch.getAreas();
      setAreas(areaList || []);
      setLoading(false);
    };
    setup();
  }, []);

  const formatAmount = (value: any) => {
    return `Rs. ${Number(value || 0).toFixed(2)}`;
  };

  const formatBalance = (value: any) => {
    const balance = Number(value || 0);
    if (balance > 0) return `Pending Rs. ${balance.toFixed(2)}`;
    if (balance < 0) return `Advance Rs. ${Math.abs(balance).toFixed(2)}`;
    return "Rs. 0.00";
  };

  const getBalanceClass = (value: any) => {
    const balance = Number(value || 0);
    if (balance > 0) return "text-red-600";
    if (balance < 0) return "text-green-600";
    return "text-gray-700";
  };

  const onAreaChange = async (areaId: string) => {
    setSelectedArea(areaId);
    setSelectedPersonId("");
    setSelectedPerson(null);
    setConnectionQuery("");
    setConnectionSuggestions([]);
    setTransactions([]);
    setCustomerBalance(0);

    if (!db || !areaId) {
      setPersonsInArea([]);
      return;
    }

    const persons = await db.getPersonsByArea(areaId);
    setPersonsInArea(persons || []);
  };

  const onConnectionQueryChange = (value: string) => {
    setConnectionQuery(value);
    setSelectedPersonId("");
    setSelectedPerson(null);
    setTransactions([]);
    setCustomerBalance(0);

    if (!value.trim()) {
      setConnectionSuggestions([]);
      return;
    }

    const q = value.toLowerCase();
    const filtered = personsInArea.filter((p) => {
      const conn = String(p.connectionNumber || "").toLowerCase();
      const name = String(p.name || "").toLowerCase();
      return conn.includes(q) || name.includes(q);
    });

    setConnectionSuggestions(filtered.slice(0, 20));
  };

  const onPersonSelect = async (person: any) => {
    setSelectedPersonId(person._id);
    setSelectedPerson(person);
    setConnectionQuery(String(person.connectionNumber || ""));
    setConnectionSuggestions([]);
    await loadLedger(person._id);
  };

  const loadLedger = async (personId: string = selectedPersonId) => {
    if (!db || !personId) {
      alert("Please select a customer");
      return;
    }

    setLoading(true);
    try {
      let result;

      if (typeof db.getCustomerLedger === "function") {
        result = await db.getCustomerLedger(personId);
      } else {
        throw new Error("getCustomerLedger function is missing in db.ts");
      }

      setTransactions(result.transactions || []);
      setCustomerBalance(Number(result.balance || 0));
    } catch (err: any) {
      alert("Failed to load customer ledger: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const printLedger = () => {
    if (!selectedPerson) {
      alert("Please select a customer");
      return;
    }

    const areaName = areas.find((a) => a._id === selectedArea)?.name || "-";
    const printWindow = window.open("", "_blank", "width=1100,height=700");
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Customer Ledger</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #111827; }
          h1 { text-align: center; margin-bottom: 10px; }
          .info { margin-bottom: 20px; border-bottom: 1px solid #ddd; padding-bottom: 10px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
          th { background: #f3f4f6; text-align: left; }
          .amount { text-align: right; }
          .sale { color: #dc2626; }
          .payment { color: #16a34a; }
          .balance { font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Family Cable Network</h1>
        <h2>Customer Ledger</h2>
        <div class="info">
          <p><strong>Customer:</strong> ${selectedPerson.name}</p>
          <p><strong>Connection #:</strong> ${selectedPerson.connectionNumber || "-"}</p>
          <p><strong>Area:</strong> ${areaName}</p>
          <p><strong>Address:</strong> ${selectedPerson.address || "-"}</p>
          <p><strong>Current Balance:</strong> ${formatBalance(customerBalance)}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th class="amount">Sale</th>
              <th class="amount">Payment</th>
              <th class="amount">Balance</th>
            </tr>
          </thead>
          <tbody>
            ${transactions
              .map(
                (t) => `
                <tr>
                  <td>${t.date || "-"}</td>
                  <td>${t.description || "-"}</td>
                  <td class="amount sale">${t.sale ? formatAmount(t.sale) : "-"}</td>
                  <td class="amount payment">${t.payment ? formatAmount(t.payment) : "-"}</td>
                  <td class="amount balance">${formatBalance(t.balance)}</td>
                </tr>
              `,
              )
              .join("")}
          </tbody>
        </table>
        <script>window.print();</script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (loading && !db) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-black">Customer Ledger</h1>
        <p className="text-sm text-gray-600">
          View customer debit, credit note, cash received, and running balance
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Area
            </label>
            <select
              value={selectedArea}
              onChange={(e) => onAreaChange(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-black"
            >
              <option value="">-- Select Area --</option>
              {areas.map((area) => (
                <option key={area._id} value={area._id}>
                  {area.name}
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
                disabled={!selectedArea}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-black disabled:bg-gray-50"
              />
              {connectionSuggestions.length > 0 && (
                <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg max-h-56 overflow-auto shadow-lg">
                  {connectionSuggestions.map((person) => (
                    <li
                      key={person._id}
                      onClick={() => onPersonSelect(person)}
                      className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-black border-b"
                    >
                      #{person.connectionNumber} - {person.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => loadLedger()}
              disabled={!selectedPersonId}
              className="px-4 py-3 flex-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Show Ledger
            </button>
            <button
              onClick={printLedger}
              disabled={!selectedPersonId || transactions.length === 0}
              className="px-4 py-3 flex-1 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Print
            </button>
          </div>
        </div>

        {selectedPerson && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6 p-4 bg-gray-50 rounded-lg border">
            <div>
              <div className="text-xs text-gray-500">Customer</div>
              <div className="font-medium text-black">{selectedPerson.name}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Connection</div>
              <div className="font-medium text-black">
                {selectedPerson.connectionNumber || "-"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Address</div>
              <div className="font-medium text-black">
                {selectedPerson.address || "-"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Current Balance</div>
              <div className={`font-semibold ${getBalanceClass(customerBalance)}`}>
                {formatBalance(customerBalance)}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-black">Ledger History</h2>
          {transactions.length > 0 && (
            <button
              onClick={printLedger}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Print Ledger
            </button>
          )}
        </div>

        {transactions.length === 0 ? (
          <div className="text-sm text-gray-500">
            Select a customer to view ledger history
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Description
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Sale
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Payment
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((row: any) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {row.date || "-"}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-900">
                      {row.description || "-"}
                    </td>
                    <td className="px-6 py-3 text-sm text-right font-medium text-red-600">
                      {row.sale ? formatAmount(row.sale) : "-"}
                    </td>
                    <td className="px-6 py-3 text-sm text-right font-medium text-green-600">
                      {row.payment ? formatAmount(row.payment) : "-"}
                    </td>
                    <td
                      className={`px-6 py-3 text-sm text-right font-semibold ${getBalanceClass(row.balance)}`}
                    >
                      {formatBalance(row.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
