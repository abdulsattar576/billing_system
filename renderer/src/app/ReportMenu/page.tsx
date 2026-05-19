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
  const [customerBalance, setCustomerBalance] = useState(0);

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
    setCustomerBalance(0);
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

  // Helper function to get valid date from document
  const getValidDate = (doc: any): Date => {
    if (doc.date) {
      const parsed = new Date(doc.date);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    if (doc.createdAt) {
      const parsed = new Date(doc.createdAt);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    if (doc._id) {
      const match = doc._id.match(/\d{13}/);
      if (match) {
        const parsed = new Date(parseInt(match[0]));
        if (!isNaN(parsed.getTime())) return parsed;
      }
    }
    return new Date();
  };

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
    const res = await db.localDB.allDocs({ include_docs: true });
    
    // Get ALL transactions for this customer (no date filter yet)
    const allCustomerDocs = res.rows
      .map((r: any) => r.doc)
      .filter(
        (d: any) => d && !d._deleted && d.personId === selectedPersonId,
      );

    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);
    endDate.setHours(23, 59, 59, 999);

    // ✅ STEP 1: Sort ALL transactions OLDEST to NEWEST (for correct balance calculation)
    const allOldestToNewest = [...allCustomerDocs].sort((a: any, b: any) => {
      return getValidDate(a).getTime() - getValidDate(b).getTime();
    });

    // ✅ STEP 2: Calculate running balance for ALL transactions (oldest to newest)
    let runningBalance = 0;
    const balanceMap = new Map();
    
    for (const doc of allOldestToNewest) {
      let amountChange = 0;
      if (doc.type === "payment" || doc.type === "debit-payment") {
        amountChange = Number(doc.amount || 0);
      } else if (doc.type === "customer-debit") {
        amountChange = -Number(doc.amount || 0);
      } else if (doc.type === "credit-note") {
        amountChange = Number(doc.amount || 0);
      }
      runningBalance += amountChange;
      balanceMap.set(doc._id, runningBalance);
    }
    
    // ✅ STEP 3: Filter transactions by date range for DISPLAY only
    const filteredDocs = allCustomerDocs.filter((doc: any) => {
      const docDate = getValidDate(doc);
      return docDate >= startDate && docDate <= endDate;
    });
    
    // ✅ STEP 4: Sort filtered transactions NEWEST to OLDEST for display
    const newestToOldest = [...filteredDocs].sort((a: any, b: any) => {
      return getValidDate(b).getTime() - getValidDate(a).getTime();
    });
    
    // ✅ STEP 5: Map transactions with their CORRECT balance (from full history)
    const transactionsWithBalance = newestToOldest.map((doc: any) => {
      let amountChange = 0;
      
      if (doc.type === "payment" || doc.type === "debit-payment") {
        amountChange = Number(doc.amount || 0);
      } else if (doc.type === "customer-debit") {
        amountChange = -Number(doc.amount || 0);
      } else if (doc.type === "credit-note") {
        amountChange = Number(doc.amount || 0);
      }
      
      const validDate = getValidDate(doc);
      
      return {
        _id: doc._id,
        _rev: doc._rev,
        date: validDate.toISOString().slice(0, 10),
        description: doc.description || "-",
        receiptNo: doc.receiptNo || "-",
        amount: Number(doc.amount || 0),
        type: doc.type,
        amountChange: amountChange,
        balance: balanceMap.get(doc._id) || 0,  // ✅ Balance from FULL history
        createdAt: doc.createdAt,
      };
    });

    setTransactions(transactionsWithBalance);
    setCustomerBalance(runningBalance);  // ✅ Final balance after ALL transactions
    
  } catch (e: any) {
    console.error("Failed to load transactions", e);
    alert("Failed to load statement: " + e.message);
  } finally {
    setLoading(false);
  }
};

  const formatBalance = (balance: number) => {
    if (balance === 0) return "0.00";
    if (balance < 0) return `${Math.abs(balance).toFixed(2)}`;
    return `(${balance.toFixed(2)})`;
  };

  const getTransactionDescription = (doc: any) => {
    if (doc.type === "payment") return "Cash Received";
    if (doc.type === "debit-payment") return "Debit Payment";
    if (doc.type === "customer-debit") {
      if (doc.isMonthlyFee) return "Monthly Fee";
      return "Purchase";
    }
    if (doc.type === "credit-note") return "Concession";
    return "-";
  };

  const printStatement = () => {
    const printWindow = window.open("", "_blank", "width=1200,height=600");
    if (!printWindow) return;

    const finalBalance = customerBalance;
    const areaName = areas.find((a) => a._id === selectedArea)?.name || "";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Customer Statement - ${selectedPerson?.name || ""}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
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
          .negative { color: #cc0000; }
          .positive { color: #00aa00; }
        </style>
      </head>
      <body>
        <h1>Family Cable Network</h1>
        <h2>Customer Statement</h2>
        <div class="customer-info">
          <p><strong>Name:</strong> ${selectedPerson?.name || "-"}</p>
          <p><strong>Connection #:</strong> ${selectedPerson?.connectionNumber || "-"}</p>
          <p><strong>Address:</strong> ${selectedPerson?.address || "-"}</p>
          <p><strong>Street:</strong> ${areaName}</p>
          <p><strong>Monthly Fee:</strong> Rs.${Number(selectedPerson?.amount || 0).toFixed(2)}</p>
          <p><strong>Period:</strong> ${new Date(fromDate).toLocaleDateString()} to ${new Date(toDate).toLocaleDateString()}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Receipt No</th>
              <th>Description</th>
              <th class="amount">Amount</th>
              <th class="amount">Balance</th>
            </tr>
          </thead>
          <tbody>
            ${transactions
              .map(
                (t) => `
              <tr>
                <td>${new Date(t.date).toLocaleDateString()}</td>
                <td>${t.receiptNo}</td>
                <td>${getTransactionDescription(t)}: ${t.description}</td>
                <td class="amount ${t.amountChange < 0 ? 'negative' : 'positive'}">
                  ${t.amountChange < 0 ? `- Rs. ${Math.abs(t.amountChange).toFixed(2)}` : `+ Rs. ${t.amountChange.toFixed(2)}`}
                </td>
                <td class="amount ${t.balance < 0 ? 'negative' : 'positive'}">
                  ${t.balance < 0 ? `- Rs. ${Math.abs(t.balance).toFixed(2)}` : t.balance > 0 ? `Rs. ${t.balance.toFixed(2)}` : "Rs. 0"}
                </td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
        <div class="footer">
          <p><strong>Current Balance: ${finalBalance < 0 ? `- Rs. ${Math.abs(finalBalance).toFixed(2)}` : finalBalance > 0 ? `Rs. ${finalBalance.toFixed(2)}` : "Rs. 0"}</strong></p>
          ${finalBalance < 0 ? '<p>Negative balance (-) means customer owes this amount (Udhari)</p>' : finalBalance > 0 ? '<p>Positive balance means customer has credit</p>' : '<p>Balance is zero</p>'}
        </div>
        <script>window.print();</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-lg text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-black">Customer Statement</h1>
        <p className="text-xs text-gray-500 mt-1">
          Negative balance (-) = Customer owes | Positive balance = Customer has credit
        </p>
      </div>

      <div className="bg-white border border-gray-300 rounded p-4 mb-6">
        <div className="mb-4">
          <label className="block text-sm text-gray-700 mb-1">Street Name:</label>
          <select
            value={selectedArea}
            onChange={(e) => onAreaChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-400 rounded bg-white text-black"
          >
            <option value="">-- Select Street --</option>
            {areas.map((a) => (
              <option key={a._id} value={a._id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm text-gray-700 mb-1">Connection No:</label>
          <div className="relative">
            <input
              type="text"
              value={connectionQuery}
              onChange={(e) => onConnectionQueryChange(e.target.value)}
              placeholder={selectedArea ? "Type connection number or name" : "Select area first"}
              disabled={!selectedArea}
              className="w-full px-3 py-2 border border-gray-400 rounded bg-white text-black disabled:bg-gray-100"
            />
            {connectionSuggestions.length > 0 && (
              <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-auto">
                {connectionSuggestions.map((p) => (
                  <li
                    key={p._id}
                    onClick={() => onPersonSelect(p)}
                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100"
                  >
                    <span className="font-medium">{p.connectionNumber}</span> - {p.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {selectedPerson && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 p-3 bg-gray-50 border border-gray-200 rounded">
            <div><div className="text-xs text-gray-500">Customer Name</div><div className="text-sm font-medium">{selectedPerson.name}</div></div>
            <div><div className="text-xs text-gray-500">Connection Date</div><div className="text-sm">{new Date(selectedPerson.createdAt).toLocaleDateString()}</div></div>
            <div><div className="text-xs text-gray-500">Monthly Fee</div><div className="text-sm">Rs.{Number(selectedPerson.amount || 0).toFixed(2)}</div></div>
            <div><div className="text-xs text-gray-500">Current Balance</div><div className={`text-sm font-bold ${customerBalance < 0 ? "text-red-600" : customerBalance > 0 ? "text-green-600" : "text-gray-600"}`}>
              {customerBalance < 0 ? `- Rs. ${Math.abs(customerBalance).toFixed(2)}` : customerBalance > 0 ? `Rs. ${customerBalance.toFixed(2)}` : "Rs. 0"}
            </div></div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div><label className="block text-sm text-gray-700 mb-1">From Date:</label><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full px-3 py-2 border border-gray-400 rounded bg-white text-black" /></div>
          <div><label className="block text-sm text-gray-700 mb-1">To Date:</label><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full px-3 py-2 border border-gray-400 rounded bg-white text-black" /></div>
        </div>

        <div className="flex gap-3">
          <button onClick={loadStatement} disabled={!selectedPersonId || !fromDate || !toDate} className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">Load Statement</button>
          {transactions.length > 0 && <button onClick={printStatement} className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700">Print Statement</button>}
          <button onClick={() => { setSelectedPerson(null); setSelectedPersonId(""); setConnectionQuery(""); setTransactions([]); setFromDate(""); setToDate(""); setCustomerBalance(0); }} className="px-6 py-2 bg-gray-400 text-white rounded hover:bg-gray-500">Clear</button>
        </div>
      </div>

      {transactions.length > 0 && (
        <div className="border border-gray-300 rounded overflow-hidden">
          <div className="px-4 py-3 bg-gray-100 border-b border-gray-300 flex justify-between items-center">
            <h2 className="text-sm font-semibold text-black">Transaction History <span className="text-xs font-normal text-gray-500 ml-2">({new Date(fromDate).toLocaleDateString()} to {new Date(toDate).toLocaleDateString()})</span></h2>
            <span className="text-xs text-gray-500">↓ Newest first</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr><th className="px-4 py-2 text-left text-xs font-medium text-gray-600 border-b border-gray-300">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 border-b border-gray-300">Receipt No</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 border-b border-gray-300">Description</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 border-b border-gray-300">Amount</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 border-b border-gray-300">Balance</th></tr>
              </thead>
              <tbody>
                {transactions.map((transaction, idx) => (
                  <tr key={transaction._id || idx} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{transaction.date}</td>
                    <td className="px-4 py-2 text-gray-600 font-mono text-xs">{transaction.receiptNo}</td>
                    <td className="px-4 py-2 text-gray-700"><span className="inline-block px-2 py-0.5 rounded text-xs mr-2 bg-gray-100 text-gray-700">{getTransactionDescription(transaction)}</span>{transaction.description}</td>
                    <td className={`px-4 py-2 text-right font-mono whitespace-nowrap ${transaction.amountChange < 0 ? "text-red-600" : "text-green-600"}`}>{transaction.amountChange < 0 ? `- Rs. ${Math.abs(transaction.amountChange).toFixed(2)}` : `+ Rs. ${transaction.amountChange.toFixed(2)}`}</td>
                    <td className={`px-4 py-2 text-right font-mono whitespace-nowrap ${transaction.balance < 0 ? "text-red-600" : transaction.balance > 0 ? "text-green-600" : "text-gray-600"}`}>{transaction.balance < 0 ? `- Rs. ${Math.abs(transaction.balance).toFixed(2)}` : transaction.balance > 0 ? `Rs. ${transaction.balance.toFixed(2)}` : "Rs. 0"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-300">
                <tr><td colSpan={4} className="px-4 py-2 text-right font-semibold text-gray-700">Current Balance:</td>
                <td className={`px-4 py-2 text-right font-bold ${customerBalance < 0 ? "text-red-600" : customerBalance > 0 ? "text-green-600" : "text-gray-600"}`}>{customerBalance < 0 ? `- Rs. ${Math.abs(customerBalance).toFixed(2)}` : customerBalance > 0 ? `Rs. ${customerBalance.toFixed(2)}` : "Rs. 0"}</td></tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {selectedPersonId && fromDate && toDate && transactions.length === 0 && !loading && (
        <div className="border border-gray-300 rounded p-12 text-center"><div className="text-gray-400 text-4xl mb-3">📋</div><div className="text-gray-500">No transactions found for the selected period</div></div>
      )}

     </div>
  );
}