"use client";
import { useEffect, useState } from "react";
import { initDB } from "../services/db";

export default function ReportMenuPage() {
  const [db, setDb] = useState<any>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const [allPersons, setAllPersons] = useState<any[]>([]);
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionQuery, setConnectionQuery] = useState("");
  const [connectionSuggestions, setConnectionSuggestions] = useState<any[]>([]);

  // Helper: Get all months between two dates
  const getMonthsInRange = (startDate: Date, endDate: Date) => {
    const months = [];
    const start = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    let current = new Date(start);
    while (current <= end) {
      months.push(new Date(current));
      current.setMonth(current.getMonth() + 1);
    }
    return months;
  };

  useEffect(() => {
    const setup = async () => {
      const pouch = await initDB();
      if (!pouch) return;
      setDb(pouch);
      try {
        const a = await pouch.getAreas();
        setAreas(a || []);
        const all = await pouch.getAllPersons();
        setAllPersons(all || []);
      } catch (e) {
        console.warn("failed to load areas/persons", e);
      }
      setLoading(false);
    };
    setup();
  }, []);

  const onAreaChange = (areaId: string) => {
    setSelectedArea(areaId);
    setSelectedPersonId("");
    setSelectedPerson(null);
    setConnectionQuery("");
    setConnectionSuggestions([]);
    setTransactions([]);
    setFromDate("");
    setToDate("");
  };

  const onPersonSelect = (person: any) => {
    setSelectedPersonId(person._id);
    setSelectedPerson(person);
    setConnectionQuery(String(person.connectionNumber ?? ""));
    setConnectionSuggestions([]);
  };

  const loadStatement = async () => {
    if (!db || !selectedPersonId) {
      alert("Please select a person");
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
      const monthlyFee = Number(selectedPerson?.amount || 0);
      const connectionDate = new Date(selectedPerson?.createdAt);

      // Calculate first fee month (month AFTER connection)
      const firstFeeMonth = new Date(
        connectionDate.getFullYear(),
        connectionDate.getMonth() + 1,
        1,
      );

      const startDate = new Date(fromDate);
      const endDate = new Date(toDate);

      // Get all months in the selected range that should have fees
      const monthsInRange = getMonthsInRange(startDate, endDate);

      // Get real transactions from database
      const res = await db.localDB.allDocs({ include_docs: true });
      const docs = res.rows
        .map((r: any) => r.doc)
        .filter(
          (d: any) => d && !d._deleted && d.personId === selectedPersonId,
        );

      // Prepare all transactions
      const allTransactions: any[] = [];

      // 1. Add VIRTUAL monthly fees (calculated on the fly)
      for (const monthDate of monthsInRange) {
        // Only add fee if month is on or after the first fee month
        if (monthDate >= firstFeeMonth) {
          const monthStr = monthDate.toISOString().slice(0, 7);
          const monthName = monthDate.toLocaleString("default", {
            month: "long",
            year: "numeric",
          });

          allTransactions.push({
            id: `virtual_fee_${monthStr}`,
            date: monthDate.toISOString(),
            description: `Monthly Fee - ${monthName}`,
            debit: monthlyFee,
            credit: 0,
            type: "fee",
            isVirtual: true,
          });
        }
      }

      // 2. Add customer purchases (from DebitAddPage)
      docs
        .filter((d: any) => d.type === "customer-debit")
        .forEach((d: any) => {
          allTransactions.push({
            id: d._id,
            date: d.date || d.createdAt,
            description: d.description,
            debit: Number(d.amount || 0),
            credit: 0,
            type: "purchase",
            isVirtual: false,
          });
        });

      // 3. Add payments received (from CashReceivedPage)
      docs
        .filter((d: any) => d.type === "payment")
        .forEach((d: any) => {
          allTransactions.push({
            id: d._id,
            date: d.createdAt,
            description: d.description || "Payment Received",
            debit: 0,
            credit: Number(d.amount || 0),
            type: "payment",
            isVirtual: false,
          });
        });

      // 4. Add concessions (from CreditNotePage)
      docs
        .filter((d: any) => d.type === "credit-note")
        .forEach((d: any) => {
          allTransactions.push({
            id: d._id,
            date: d.date || d.createdAt,
            description: d.description,
            debit: 0,
            credit: Number(d.amount || 0),
            type: "concession",
            isVirtual: false,
          });
        });

      // Sort by date
      allTransactions.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );

      // Calculate running balance
      let runningBalance = 0;
      const transactionsWithBalance = allTransactions.map((t) => {
        if (t.debit > 0) {
          runningBalance += t.debit;
        } else if (t.credit > 0) {
          runningBalance -= t.credit;
        }
        return {
          ...t,
          balance: runningBalance,
        };
      });

      setTransactions(transactionsWithBalance);
    } catch (e: any) {
      console.error("Failed to load transactions", e);
      alert("Failed to load statement: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const printStatement = () => {
    const printWindow = window.open("", "", "width=1200,height=600");
    if (!printWindow) return;

    const totalDebit = transactions.reduce((sum, t) => sum + t.debit, 0);
    const totalCredit = transactions.reduce((sum, t) => sum + t.credit, 0);
    const closingBalance = totalDebit - totalCredit;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Customer Statement - ${selectedPerson?.name || ""}</title>
        <style>
          * { margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { text-align: center; margin-bottom: 10px; font-size: 24px; }
          h2 { text-align: center; margin-bottom: 20px; font-size: 16px; color: #666; }
          .customer-info { margin-bottom: 20px; padding: 10px; background: #f3f4f6; border-radius: 8px; }
          .customer-info p { margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          thead { background-color: #f3f4f6; }
          th { padding: 12px; text-align: left; font-weight: bold; border-bottom: 2px solid #d1d5db; }
          td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; }
          .amount { text-align: right; }
          .debit { color: #dc2626; }
          .credit { color: #16a34a; }
          .virtual { color: #6b7280; font-style: italic; }
          .total-row { background-color: #f3f4f6; font-weight: bold; }
          .footer { margin-top: 30px; text-align: right; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Family Cable Network</h1>
        <h2>Customer Statement</h2>
        <div class="customer-info">
          <p><strong>Name:</strong> ${selectedPerson?.name || "-"}</p>
          <p><strong>Connection #:</strong> ${selectedPerson?.connectionNumber || "-"}</p>
          <p><strong>Address:</strong> ${selectedPerson?.address || "-"}</p>
          <p><strong>Monthly Fee:</strong> Rs.${Number(selectedPerson?.amount || 0).toFixed(2)}</p>
          <p><strong>Connection Date:</strong> ${new Date(selectedPerson?.createdAt).toLocaleDateString()}</p>
          <p><strong>Period:</strong> ${fromDate} to ${toDate}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th class="amount">Debit</th>
              <th class="amount">Credit</th>
              <th class="amount">Balance</th>
            </tr>
          </thead>
          <tbody>
            ${transactions
              .map(
                (t) => `
              <tr>
                <td>${new Date(t.date).toLocaleDateString()}</td>
                <td class="${t.isVirtual ? "virtual" : ""}">${t.description || "-"}${t.isVirtual ? " (Auto)" : ""}</td>
                <td class="amount debit">${t.debit > 0 ? `Rs.${t.debit.toFixed(2)}` : "-"}</td>
                <td class="amount credit">${t.credit > 0 ? `Rs.${t.credit.toFixed(2)}` : "-"}</td>
                <td class="amount">Rs.${t.balance.toFixed(2)}</td>
              </tr>
            `,
              )
              .join("")}
            <tr class="total-row">
              <td colspan="2"><strong>Totals</strong></td>
              <td class="amount"><strong>Rs.${totalDebit.toFixed(2)}</strong></td>
              <td class="amount"><strong>Rs.${totalCredit.toFixed(2)}</strong></td>
              <td class="amount"><strong>Rs.${closingBalance.toFixed(2)}</strong></td>
            </tr>
          </tbody>
        </table>
        <div class="footer">
          <p><strong>Outstanding Balance: Rs.${closingBalance.toFixed(2)}</strong></p>
          ${closingBalance > 0 ? '<p style="color: #dc2626;">⚠ Please clear the outstanding amount</p>' : '<p style="color: #16a34a;">✓ Account is up to date</p>'}
        </div>
        <script>window.print();</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const totalDebit = transactions.reduce((sum, t) => sum + t.debit, 0);
  const totalCredit = transactions.reduce((sum, t) => sum + t.credit, 0);
  const closingBalance = totalDebit - totalCredit;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-black">Customer Statement</h1>
        <p className="text-sm text-gray-600">
          Complete transaction history - Monthly fees calculated based on
          connection date
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        {/* Area Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Area
          </label>
          <select
            value={selectedArea}
            onChange={(e) => onAreaChange(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
          >
            <option value="">-- Select Area --</option>
            {areas.map((a) => (
              <option key={a._id} value={a._id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* Connection Number */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Connection Number / Name
          </label>
          <div className="relative">
            <input
              type="text"
              value={connectionQuery}
              onChange={(e) => {
                const q = e.target.value;
                setConnectionQuery(q);
                if (!q.trim()) {
                  setConnectionSuggestions([]);
                  setSelectedPerson(null);
                  return;
                }
                const filtered = allPersons
                  .filter((p) => !selectedArea || p.areaId === selectedArea)
                  .filter(
                    (p) =>
                      String(p.connectionNumber || "")
                        .toLowerCase()
                        .includes(q.toLowerCase()) ||
                      String(p.name || "")
                        .toLowerCase()
                        .includes(q.toLowerCase()),
                  )
                  .slice(0, 20);
                setConnectionSuggestions(filtered);
              }}
              placeholder={
                selectedArea
                  ? "Type connection # or name..."
                  : "Select area first"
              }
              disabled={!selectedArea}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black disabled:bg-gray-50"
            />
            {connectionSuggestions.length > 0 && (
              <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded max-h-60 overflow-auto shadow-lg">
                {connectionSuggestions.map((p) => (
                  <li
                    key={p._id}
                    onClick={() => onPersonSelect(p)}
                    className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-black border-b border-gray-100"
                  >
                    <div className="font-medium">
                      Conn #{p.connectionNumber ?? "-"} — {p.name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {p.address || "-"}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Customer Details */}
        {selectedPerson && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-xs text-gray-500">
                Customer Name
              </label>
              <div className="text-sm font-medium text-black">
                {selectedPerson.name}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Address</label>
              <div className="text-sm text-black">
                {selectedPerson.address || "-"}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Monthly Fee</label>
              <div className="text-sm font-medium text-black">
                Rs.{Number(selectedPerson.amount || 0).toFixed(2)}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500">
                Connected From
              </label>
              <div className="text-sm text-black">
                {new Date(selectedPerson.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        )}

        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={loadStatement}
            disabled={!selectedPersonId || !fromDate || !toDate}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-700 text-white rounded-lg hover:from-blue-700 hover:to-purple-800 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Load Statement
          </button>
          {transactions.length > 0 && (
            <button
              onClick={printStatement}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-teal-700 text-white rounded-lg hover:from-green-700 hover:to-teal-800 transition-all font-semibold"
            >
              Print
            </button>
          )}
        </div>
      </div>

      {/* Statement Table */}
      {transactions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-black">
              Transaction History
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({fromDate} to {toDate})
              </span>
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              * Monthly fees are calculated automatically from connection date.
              (Auto) indicates calculated fees.
            </p>
          </div>

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
                    Debit
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Credit
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((transaction, idx) => (
                  <tr
                    key={transaction.id || idx}
                    className={`hover:bg-gray-50 ${transaction.isVirtual ? "bg-gray-50/50" : ""}`}
                  >
                    <td className="px-6 py-3 text-sm text-gray-900">
                      {new Date(transaction.date).toLocaleDateString()}
                    </td>
                    <td
                      className={`px-6 py-3 text-sm ${transaction.isVirtual ? "text-gray-500 italic" : "text-gray-600"}`}
                    >
                      {transaction.description || "-"}
                      {transaction.isVirtual && (
                        <span className="text-xs text-gray-400 ml-2">
                          (Auto-calculated)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm text-right text-red-600 font-medium">
                      {transaction.debit > 0
                        ? `Rs.${transaction.debit.toFixed(2)}`
                        : "-"}
                    </td>
                    <td className="px-6 py-3 text-sm text-right text-green-600 font-medium">
                      {transaction.credit > 0
                        ? `Rs.${transaction.credit.toFixed(2)}`
                        : "-"}
                    </td>
                    <td className="px-6 py-3 text-sm text-right font-semibold text-gray-900">
                      Rs.{transaction.balance.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td
                    colSpan={2}
                    className="px-6 py-3 text-sm font-bold text-gray-900"
                  >
                    Totals
                  </td>
                  <td className="px-6 py-3 text-sm text-right font-bold text-red-600">
                    Rs.{totalDebit.toFixed(2)}
                  </td>
                  <td className="px-6 py-3 text-sm text-right font-bold text-green-600">
                    Rs.{totalCredit.toFixed(2)}
                  </td>
                  <td className="px-6 py-3 text-sm text-right font-bold text-blue-600">
                    Rs.{closingBalance.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Summary */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Outstanding Balance</p>
                <p
                  className={`text-2xl font-bold ${closingBalance > 0 ? "text-red-600" : "text-green-600"}`}
                >
                  Rs.{closingBalance.toFixed(2)}
                </p>
              </div>
              <div className="text-right text-xs text-gray-400">
                <p>
                  • Monthly fees calculated from{" "}
                  {new Date(selectedPerson?.createdAt).toLocaleDateString()}
                </p>
                <p>• Only months after connection date are included</p>
                <p>• Concessions and payments reduce balance</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedPersonId &&
        fromDate &&
        toDate &&
        transactions.length === 0 &&
        !loading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-gray-400 text-4xl mb-3">📋</div>
            <div className="text-gray-500">
              No transactions found for the selected period
            </div>
          </div>
        )}
    </div>
  );
}
