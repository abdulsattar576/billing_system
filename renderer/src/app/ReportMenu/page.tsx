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
  const [monthlyStatus, setMonthlyStatus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionQuery, setConnectionQuery] = useState("");
  const [connectionSuggestions, setConnectionSuggestions] = useState<any[]>([]);
  const [customerBalance, setCustomerBalance] = useState(0);
  const [pendingMonths, setPendingMonths] = useState<any[]>([]);

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
    setMonthlyStatus([]);
    setFromDate("");
    setToDate("");
    setCustomerBalance(0);
    setPendingMonths([]);
  };

  const onPersonSelect = (person: any) => {
    setSelectedPersonId(person._id);
    setSelectedPerson(person);
    setConnectionQuery(String(person.connectionNumber ?? ""));
    setConnectionSuggestions([]);
  };

  const onConnectionQueryChange = (q: string) => {
    setConnectionQuery(q);
    setSelectedPersonId("");
    setSelectedPerson(null);
    setTransactions([]);

    if (!q.trim()) {
      setConnectionSuggestions([]);
      return;
    }

    const qLower = q.toLowerCase();
    const personsList = selectedArea
      ? allPersons.filter((p) => p.areaId === selectedArea)
      : allPersons;

    const filtered = personsList
      .filter((p) => {
        const conn = String(p.connectionNumber ?? "").toLowerCase();
        const name = String(p.name ?? "").toLowerCase();
        return conn.includes(qLower) || name.includes(qLower);
      })
      .slice(0, 20);

    setConnectionSuggestions(filtered);
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
      const firstFeeMonth = new Date(
        connectionDate.getFullYear(),
        connectionDate.getMonth() + 1,
        1,
      );

      const startDate = new Date(fromDate);
      const endDate = new Date(toDate);
      const monthsInRange = getMonthsInRange(startDate, endDate);

      const res = await db.localDB.allDocs({ include_docs: true });
      const docs = res.rows
        .map((r: any) => r.doc)
        .filter(
          (d: any) => d && !d._deleted && d.personId === selectedPersonId,
        );

      // Get payments by month
      const paymentsByMonth = new Map();
      docs
        .filter((d: any) => d.type === "payment" && d.paymentMonth)
        .forEach((p: any) => {
          const existing = paymentsByMonth.get(p.paymentMonth) || 0;
          paymentsByMonth.set(p.paymentMonth, existing + Number(p.amount || 0));
        });

      // Get debit payments
      const debitPayments = docs
        .filter((d: any) => d.type === "debit-payment")
        .map((d: any) => ({
          id: d._id,
          date: d.createdAt,
          description: d.description || "Debit Payment",
          amount: Number(d.amount || 0),
        }));

      // Get purchases (Udhari)
      const purchases = docs
        .filter((d: any) => d.type === "customer-debit")
        .map((d: any) => ({
          id: d._id,
          date: d.date || d.createdAt,
          description: d.description,
          amount: Number(d.amount || 0),
        }));

      // Get concessions
      const concessions = docs
        .filter((d: any) => d.type === "credit-note")
        .map((d: any) => ({
          id: d._id,
          date: d.date || d.createdAt,
          description: d.description,
          amount: Number(d.amount || 0),
        }));

      // Get other payments
      const otherPayments = docs
        .filter((d: any) => d.type === "payment" && !d.paymentMonth)
        .map((d: any) => ({
          id: d._id,
          date: d.createdAt,
          description: d.description || "Cash Received",
          amount: Number(d.amount || 0),
        }));

      const allTransactions: any[] = [];
      const monthlyFeeStatus = [];
      let runningBalance = 0;

      // Track paid months for status
      const paidMonthsSet = new Set();
      paymentsByMonth.forEach((_, month) => paidMonthsSet.add(month));

      for (const monthDate of monthsInRange) {
        const monthStr = monthDate.toISOString().slice(0, 7);
        const monthName = monthDate.toLocaleString("default", {
          month: "long",
          year: "numeric",
        });
        
        if (monthDate >= firstFeeMonth) {
          const paidAmount = paymentsByMonth.get(monthStr) || 0;
          const isPaid = paidAmount >= monthlyFee;
          
          // Monthly Fee Deduction
          if (monthDate <= new Date()) {
            allTransactions.push({
              id: `fee_${monthStr}`,
              date: monthDate.toISOString(),
              description: `${monthName} - Monthly Fee`,
              amountChange: -monthlyFee,
              type: "fee",
            });
            runningBalance -= monthlyFee;
          }
          
          // Cash Received for this month
          if (paidAmount > 0) {
            allTransactions.push({
              id: `payment_${monthStr}`,
              date: monthDate.toISOString(),
              description: `${monthName} - Cash Received`,
              amountChange: paidAmount,
              type: "payment",
            });
            runningBalance += paidAmount;
          }
          
          monthlyFeeStatus.push({
            month: monthStr,
            monthName: monthName,
            fee: monthlyFee,
            deducted: monthDate <= new Date() ? monthlyFee : 0,
            paid: paidAmount,
            netChange: paidAmount - (monthDate <= new Date() ? monthlyFee : 0),
            status: isPaid ? "Paid" : paidAmount > 0 ? "Partial" : "Unpaid",
          });
        }
        
        // Add purchases
        const monthPurchases = purchases.filter(p => {
          const pDate = new Date(p.date);
          return pDate.getFullYear() === monthDate.getFullYear() && 
                 pDate.getMonth() === monthDate.getMonth();
        });
        monthPurchases.forEach(p => {
          allTransactions.push({
            id: p.id,
            date: p.date,
            description: `Purchase (Udhari): ${p.description}`,
            amountChange: -p.amount,
            type: "purchase",
          });
          runningBalance -= p.amount;
        });
        
        // Add concessions
        const monthConcessions = concessions.filter(c => {
          const cDate = new Date(c.date);
          return cDate.getFullYear() === monthDate.getFullYear() && 
                 cDate.getMonth() === monthDate.getMonth();
        });
        monthConcessions.forEach(c => {
          allTransactions.push({
            id: c.id,
            date: c.date,
            description: `Concession: ${c.description}`,
            amountChange: c.amount,
            type: "concession",
          });
          runningBalance += c.amount;
        });
      }
      
      // Add debit payments
      debitPayments.forEach(dp => {
        const dpDate = new Date(dp.date);
        if (dpDate >= startDate && dpDate <= endDate) {
          allTransactions.push({
            id: dp.id,
            date: dp.date,
            description: `Debit Payment: ${dp.description}`,
            amountChange: dp.amount,
            type: "debit_payment",
          });
          runningBalance += dp.amount;
        }
      });
      
      // Add other payments
      otherPayments.forEach(p => {
        const pDate = new Date(p.date);
        if (pDate >= startDate && pDate <= endDate) {
          allTransactions.push({
            id: p.id,
            date: p.date,
            description: p.description,
            amountChange: p.amount,
            type: "payment",
          });
          runningBalance += p.amount;
        }
      });

      // Sort by date
      allTransactions.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );

      // Calculate running balance
      let balance = 0;
      const transactionsWithBalance = allTransactions.map((t) => {
        balance += t.amountChange;
        return {
          ...t,
          balance: balance,
        };
      });

      setTransactions(transactionsWithBalance);
      setMonthlyStatus(monthlyFeeStatus);
      setCustomerBalance(runningBalance);
      
      // Get pending months for display
      const pending = [];
      let feeDate = new Date(connectionDate.getFullYear(), connectionDate.getMonth() + 1, 1);
      const today = new Date();
      while (feeDate <= today) {
        const monthStr = feeDate.toISOString().slice(0, 7);
        if (!paidMonthsSet.has(monthStr)) {
          pending.push({
            month: monthStr,
            monthName: feeDate.toLocaleString('default', { month: 'long', year: 'numeric' }),
            amount: monthlyFee,
          });
        }
        feeDate.setMonth(feeDate.getMonth() + 1);
      }
      setPendingMonths(pending);
      
    } catch (e: any) {
      console.error("Failed to load transactions", e);
      alert("Failed to load statement: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const formatBalance = (balance: number) => {
    if (balance === 0) return "Rs. 0";
    if (balance < 0) return `-Rs. ${Math.abs(balance).toFixed(2)}`;
    return `Rs. ${balance.toFixed(2)}`;
  };

  const printStatement = () => {
    const printWindow = window.open("", "", "width=1200,height=600");
    if (!printWindow) return;

    const finalBalance = customerBalance;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Customer Statement - ${selectedPerson?.name || ""}</title>
        <style>
          * { margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
          h1 { text-align: center; margin-bottom: 10px; font-size: 22px; }
          h2 { text-align: center; margin-bottom: 20px; font-size: 14px; color: #333; }
          .customer-info { margin-bottom: 20px; padding: 10px; background: #f5f5f5; border: 1px solid #ddd; }
          .customer-info p { margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { padding: 10px; text-align: left; font-weight: bold; border-bottom: 2px solid #000; background: #f0f0f0; }
          td { padding: 8px 10px; border-bottom: 1px solid #ddd; }
          .amount { text-align: right; }
          .footer { margin-top: 30px; text-align: right; font-weight: bold; padding-top: 15px; border-top: 2px solid #000; }
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
          <p><strong>Period:</strong> ${new Date(fromDate).toLocaleDateString()} to ${new Date(toDate).toLocaleDateString()}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th class="amount">Debit (-)</th>
              <th class="amount">Credit (+)</th>
              <th class="amount">Balance</th>
            </tr>
          </thead>
          <tbody>
            ${transactions
              .map(
                (t) => `
              <tr>
                <td>${new Date(t.date).toLocaleDateString()}</td>
                <td>${t.description}</td>
                <td class="amount">${t.amountChange < 0 ? `Rs. ${Math.abs(t.amountChange).toFixed(2)}` : "-"}</td>
                <td class="amount">${t.amountChange > 0 ? `Rs. ${t.amountChange.toFixed(2)}` : "-"}</td>
                <td class="amount">${formatBalance(t.balance)}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
        <div class="footer">
          <p><strong>Current Balance: ${formatBalance(finalBalance)}</strong></p>
          ${finalBalance < 0 ? '<p>Customer owes this amount (Udhari)</p>' : finalBalance > 0 ? '<p>Customer has credit balance</p>' : '<p>Balance is zero</p>'}
        </div>
        <script>window.print();</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const finalBalance = customerBalance;

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
          Positive balance = Customer has credit | Negative balance (-) = Customer owes (Udhari)
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        {/* Area Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Area</label>
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
          <label className="block text-sm font-medium text-gray-700 mb-2">Connection Number / Name</label>
          <div className="relative">
            <input
              type="text"
              value={connectionQuery}
              onChange={(e) => onConnectionQueryChange(e.target.value)}
              placeholder={selectedArea ? "Type connection # or name..." : "Select area first"}
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
                    <div className="font-medium">Conn #{p.connectionNumber ?? "-"} — {p.name}</div>
                    <div className="text-xs text-gray-400">{p.address || "-"}</div>
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
              <label className="block text-xs text-gray-500">Customer Name</label>
              <div className="text-sm font-medium text-black">{selectedPerson.name}</div>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Connection Date</label>
              <div className="text-sm text-black">{new Date(selectedPerson.createdAt).toLocaleDateString()}</div>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Monthly Fee</label>
              <div className="text-sm font-medium text-black">Rs.{Number(selectedPerson.amount || 0).toFixed(2)}</div>
            </div>
            <div>
              <label className="block text-xs text-gray-500">Current Balance</label>
              <div className={`text-sm font-bold ${finalBalance < 0 ? "text-red-600" : finalBalance > 0 ? "text-green-600" : "text-gray-600"}`}>
                {formatBalance(finalBalance)}
              </div>
            </div>
          </div>
        )}

        {/* Pending Months Warning */}
        {pendingMonths.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
            <h3 className="text-sm font-semibold text-red-800 mb-2">⚠ Pending Monthly Fees (Not Paid Yet)</h3>
            <div className="space-y-1">
              {pendingMonths.map((month, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>{month.monthName}</span>
                  <span className="font-medium text-red-600">Rs. {month.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-red-600 mt-2">
              ⚠ These months have been deducted but not paid. Pay them first!
            </p>
          </div>
        )}

        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
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
            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-700 text-white rounded-lg hover:from-blue-700 hover:to-purple-800 transition-all font-semibold disabled:opacity-50"
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

      {/* Monthly Fee Status */}
      {monthlyStatus.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-black mb-4">Monthly Fee Status</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Month</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Fee</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Paid</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Remaining</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {monthlyStatus.map((m) => (
                  <tr key={m.month}>
                    <td className="px-4 py-2 text-sm text-gray-900">{m.monthName}</td>
                    <td className="px-4 py-2 text-sm text-right">Rs.{m.fee.toFixed(2)}</td>
                    <td className="px-4 py-2 text-sm text-right text-green-600">Rs.{m.paid.toFixed(2)}</td>
                    <td className="px-4 py-2 text-sm text-right text-red-600">Rs.{(m.fee - m.paid).toFixed(2)}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        m.status === "Paid" ? "bg-green-100 text-green-800" :
                        m.status === "Partial" ? "bg-yellow-100 text-yellow-800" :
                        "bg-red-100 text-red-800"
                      }`}>
                        {m.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transaction Table */}
      {transactions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-black">
              Transaction History
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({new Date(fromDate).toLocaleDateString()} to {new Date(toDate).toLocaleDateString()})
              </span>
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Debit (-) = Money taken | Credit (+) = Money added | Negative balance (-) = Customer owes
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Debit (-)</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credit (+)</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((transaction, idx) => (
                  <tr key={transaction.id || idx} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-900">
                      {new Date(transaction.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {transaction.description}
                    </td>
                    <td className="px-6 py-3 text-sm text-right text-red-600 font-medium">
                      {transaction.amountChange < 0 ? `Rs. ${Math.abs(transaction.amountChange).toFixed(2)}` : "-"}
                    </td>
                    <td className="px-6 py-3 text-sm text-right text-green-600 font-medium">
                      {transaction.amountChange > 0 ? `Rs. ${transaction.amountChange.toFixed(2)}` : "-"}
                    </td>
                    <td className="px-6 py-3 text-sm text-right font-semibold">
                      <span className={transaction.balance < 0 ? "text-red-600" : "text-green-600"}>
                        {formatBalance(transaction.balance)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Current Balance Summary */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-end">
              <div className="text-right">
                <p className="text-sm text-gray-500">Current Balance</p>
                <p className={`text-2xl font-bold ${finalBalance < 0 ? "text-red-600" : finalBalance > 0 ? "text-green-600" : "text-gray-600"}`}>
                  {formatBalance(finalBalance)}
                </p>
                {finalBalance < 0 ? (
                  <p className="text-xs text-red-500 mt-1">⚠ Customer owes this amount (Udhari)</p>
                ) : finalBalance > 0 ? (
                  <p className="text-xs text-green-500 mt-1">✓ Customer has credit balance</p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">✓ Balance is zero</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedPersonId && fromDate && toDate && transactions.length === 0 && !loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-gray-400 text-4xl mb-3">📋</div>
          <div className="text-gray-500">No transactions found for the selected period</div>
        </div>
      )}
    </div>
  );
}