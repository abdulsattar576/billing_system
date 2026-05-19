"use client";
import { useEffect, useState, useRef } from "react";
import { initDB } from "../services/db";

export default function CashReceivedPage() {
  const [db, setDb] = useState<any>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const [allPersons, setAllPersons] = useState<any[]>([]);
  const [selectedArea, setSelectedArea] = useState("");
  const [connectionQuery, setConnectionQuery] = useState("");
  const [connectionSuggestions, setConnectionSuggestions] = useState<any[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [displayPersons, setDisplayPersons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [areaTotalDue, setAreaTotalDue] = useState(0);
  const [areaTotalCustomers, setAreaTotalCustomers] = useState(0);
  
  // Form fields
  const [receiptNo, setReceiptNo] = useState("");
  const [cashReceived, setCashReceived] = useState<number | "">("");
  const [description, setDescription] = useState("");
  
  // Transaction history for single customer
  const [transactions, setTransactions] = useState<any[]>([]);
  
  const cashReceivedRef = useRef<HTMLInputElement>(null);

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
        console.warn(e);
      }
      setLoading(false);
    };
    setup();
  }, []);

  // Calculate balance for a person
  const calculatePersonBalance = async (personId: string) => {
    if (!db) return 0;
    try {
      const balance = await db.calculateCustomerBalance(personId);
      return balance;
    } catch (e) {
      return 0;
    }
  };

  // Calculate area totals (Total Due from all customers in area)
  const calculateAreaTotals = (persons: any[]) => {
    let totalDue = 0;
    let customerCount = persons.length;
    
    for (const person of persons) {
      const balance = person.balance || 0;
      // If balance is negative, customer owes money
      if (balance < 0) {
        totalDue += Math.abs(balance);
      }
      // If balance is positive, customer has credit (overpaid) - not counted in due
    }
    
    return { totalDue, customerCount };
  };

  // Get area name by ID
  const getAreaName = (areaId: string) => {
    const area = areas.find(a => a._id === areaId);
    return area ? area.name : "-";
  };

  // Load all persons in area with balances
  const loadAreaPersons = async (areaId: string) => {
    if (!db) return;
    const persons = allPersons.filter(p => p.areaId === areaId);
    const personsWithBalance = await Promise.all(
      persons.map(async (p) => ({
        ...p,
        balance: await calculatePersonBalance(p._id)
      }))
    );
    setDisplayPersons(personsWithBalance);
    
    const totals = calculateAreaTotals(personsWithBalance);
    setAreaTotalDue(totals.totalDue);
    setAreaTotalCustomers(totals.customerCount);
    
    setSelectedPerson(null);
    setTransactions([]);
    setReceiptNo("");
    setCashReceived("");
    setDescription("");
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

  // Load transactions for a person - CHRONOLOGICAL ORDER (oldest first)
  const loadTransactions = async (personId: string) => {
    if (!db) return;
    try {
      const res = await db.localDB.allDocs({ include_docs: true });
      const docs = res.rows
        .map((r: any) => r.doc)
        .filter((d: any) => d && !d._deleted && d.personId === personId);
      
      const chronologicalDocs = docs.sort((a: any, b: any) => {
        const dateA = getValidDate(a).getTime();
        const dateB = getValidDate(b).getTime();
        return dateA - dateB;
      });
      
      let runningBalance = 0;
      const transactionsWithBalance = chronologicalDocs.map((doc: any) => {
        const validDate = getValidDate(doc);
        let amountChange = 0;
        
        if (doc.type === "payment" || doc.type === "debit-payment") {
          amountChange = Number(doc.amount || 0);
        } else if (doc.type === "customer-debit") {
          amountChange = -Number(doc.amount || 0);
        } else if (doc.type === "credit-note") {
          amountChange = Number(doc.amount || 0);
        }
        
        runningBalance += amountChange;
        
        return {
          _id: doc._id,
          _rev: doc._rev,
          date: validDate.toISOString().slice(0, 10),
          description: doc.description || "-",
          receiptNo: doc.receiptNo || "-",
          amount: Number(doc.amount || 0),
          type: doc.type,
          amountChange: amountChange,
          runningBalance: runningBalance,
          createdAt: doc.createdAt,
        };
      });
      
      setTransactions(transactionsWithBalance);
    } catch (e) {
      console.error("Failed to load transactions", e);
    }
  };

  // Load single person when connection number is entered
  const loadSinglePerson = async (query: string) => {
    if (!db) return;
    const qLower = query.toLowerCase();
    const person = allPersons.find(
      p => p.areaId === selectedArea && 
      (String(p.connectionNumber).toLowerCase() === qLower || 
       p.name.toLowerCase() === qLower)
    );
    
    if (person) {
      const balance = await calculatePersonBalance(person._id);
      const personsWithBalance = [{ ...person, balance }];
      setDisplayPersons(personsWithBalance);
      
      const totals = calculateAreaTotals(personsWithBalance);
      setAreaTotalDue(totals.totalDue);
      setAreaTotalCustomers(totals.customerCount);
      
      setSelectedPerson(person);
      await loadTransactions(person._id);
      setConnectionSuggestions([]);
    } else {
      setDisplayPersons([]);
      setAreaTotalDue(0);
      setAreaTotalCustomers(0);
      setSelectedPerson(null);
      setTransactions([]);
    }
  };

  const onAreaChange = async (areaId: string) => {
    setSelectedArea(areaId);
    setConnectionQuery("");
    setSelectedPerson(null);
    setReceiptNo("");
    setCashReceived("");
    setDescription("");
    setTransactions([]);
    setConnectionSuggestions([]);
    
    if (areaId) {
      await loadAreaPersons(areaId);
    } else {
      setDisplayPersons([]);
      setAreaTotalDue(0);
      setAreaTotalCustomers(0);
    }
  };

  const onConnectionQueryChange = async (q: string) => {
    setConnectionQuery(q);
    setSelectedPerson(null);
    setReceiptNo("");
    setCashReceived("");
    setDescription("");
    setTransactions([]);
    
    if (!q.trim() && selectedArea) {
      await loadAreaPersons(selectedArea);
      setConnectionSuggestions([]);
      return;
    }
    
    if (q.trim() && selectedArea) {
      const qLower = q.toLowerCase();
      const matches = allPersons.filter(
        p => p.areaId === selectedArea && 
        (String(p.connectionNumber).toLowerCase().includes(qLower) || 
         p.name.toLowerCase().includes(qLower))
      ).slice(0, 10);
      setConnectionSuggestions(matches);
      
      const exactMatch = matches.find(
        p => String(p.connectionNumber).toLowerCase() === qLower || 
        p.name.toLowerCase() === qLower
      );
      if (exactMatch) {
        await loadSinglePerson(q);
      } else {
        setDisplayPersons([]);
        setAreaTotalDue(0);
        setAreaTotalCustomers(0);
        setSelectedPerson(null);
      }
    } else {
      setConnectionSuggestions([]);
    }
  };

  const onPersonSelect = async (person: any) => {
    setConnectionQuery(String(person.connectionNumber));
    setSelectedPerson(person);
    setDisplayPersons([person]);
    
    const balance = await calculatePersonBalance(person._id);
    const totals = calculateAreaTotals([{ ...person, balance }]);
    setAreaTotalDue(totals.totalDue);
    setAreaTotalCustomers(totals.customerCount);
    
    setConnectionSuggestions([]);
    setReceiptNo("");
    setCashReceived("");
    setDescription("");
    await loadTransactions(person._id);
    setTimeout(() => cashReceivedRef.current?.focus(), 100);
  };

  const savePayment = async () => {
    if (!db || !selectedPerson) {
      alert("Please select a customer");
      return;
    }
    if (!receiptNo.trim()) {
      alert("Please enter Receipt Number");
      return;
    }
    if (cashReceived === "" || Number(cashReceived) <= 0) {
      alert("Please enter Cash Received amount");
      return;
    }

    setSaving(true);
    const now = new Date();
    const todayDate = now.toISOString().slice(0, 10);
    
    try {
      const paymentDoc = {
        _id: `payment_${selectedPerson._id}_${Date.now()}`,
        type: "payment",
        areaId: selectedArea,
        personId: selectedPerson._id,
        connectionNumber: selectedPerson.connectionNumber,
        personName: selectedPerson.name,
        personAddress: selectedPerson.address,
        receiptNo: receiptNo.trim(),
        amount: Number(cashReceived),
        description: description.trim() || "Cash received",
        date: todayDate,
        createdAt: now.toISOString(),
      };
      await db.localDB.put(paymentDoc);
      
      await loadTransactions(selectedPerson._id);
      
      const newBalance = await calculatePersonBalance(selectedPerson._id);
      const updatedPerson = { ...selectedPerson, balance: newBalance };
      setDisplayPersons([updatedPerson]);
      
      const totals = calculateAreaTotals([updatedPerson]);
      setAreaTotalDue(totals.totalDue);
      setAreaTotalCustomers(totals.customerCount);
      
      setReceiptNo("");
      setCashReceived("");
      setDescription("");
      
      alert(`Payment saved successfully!\n\nCustomer: ${selectedPerson.name}\nReceipt Number: ${receiptNo}\nAmount: Rs. ${Number(cashReceived).toFixed(2)}`);
      
    } catch (e: any) {
      alert("Failed to save: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const printReceipt = () => {
    if (!selectedPerson) {
      alert("Please select a customer first");
      return;
    }
    
    setPrinting(true);
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) {
      alert("Please allow pop-ups to print");
      setPrinting(false);
      return;
    }

    const areaName = areas.find((a) => a._id === selectedArea)?.name || "";
    const currentDate = new Date().toLocaleString();
    const currentBalance = transactions[transactions.length - 1]?.runningBalance || 0;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Cash Receipt</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; }
          .receipt { max-width: 500px; margin: 0 auto; border: 2px solid #000; border-radius: 10px; padding: 20px; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
          .urdu { font-family: 'Noto Nastaliq Urdu', Arial; direction: rtl; font-size: 20px; font-weight: bold; }
          .title { font-size: 18px; font-weight: bold; margin-top: 5px; }
          .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; padding: 5px 0; border-bottom: 1px dashed #ccc; }
          .label { font-weight: bold; }
          .total { margin-top: 20px; padding-top: 15px; border-top: 2px solid #000; font-size: 18px; font-weight: bold; }
          .balance { margin-top: 15px; padding: 10px; background: #f0f0f0; text-align: center; }
          .footer { text-align: center; margin-top: 30px; font-size: 11px; color: #666; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <div class="urdu">فیملی کیبل نیٹ ورک</div>
            <div class="title">CASH RECEIPT</div>
          </div>
          <div class="detail-row"><span class="label">Receipt No:</span><span>${receiptNo || "N/A"}</span></div>
          <div class="detail-row"><span class="label">Date:</span><span>${currentDate}</span></div>
          <div class="detail-row"><span class="label">Connection No:</span><span>${selectedPerson.connectionNumber}</span></div>
          <div class="detail-row"><span class="label">Customer Name:</span><span>${selectedPerson.name}</span></div>
          <div class="detail-row"><span class="label">Street:</span><span>${areaName}</span></div>
          <div class="detail-row"><span class="label">Address:</span><span>${selectedPerson.address || "-"}</span></div>
          ${description ? `<div class="detail-row"><span class="label">Description:</span><span>${description}</span></div>` : ""}
          <div class="total"><span class="label">Amount Received:</span><span>Rs. ${Number(cashReceived).toFixed(2)}</span></div>
          <div class="balance"><span class="label">Balance After Payment:</span><span>${currentBalance >= 0 ? `Rs. ${currentBalance.toFixed(2)}` : `-Rs. ${Math.abs(currentBalance).toFixed(2)}`}</span></div>
          <div class="footer">Thank you for your payment!</div>
        </div>
        <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}</script>
      </body>
      </html>
    `);
    printWindow.document.close();
    setPrinting(false);
  };

  const getTransactionType = (doc: any) => {
    if (doc.type === "payment") return "Cash Received";
    if (doc.type === "debit-payment") return "Debit Payment";
    if (doc.type === "customer-debit") {
      if (doc.isMonthlyFee) return "Monthly Fee";
      return "Purchase";
    }
    if (doc.type === "credit-note") return "Concession";
    return "-";
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
        <h1 className="text-xl font-bold text-black">Cash Received From Customer</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
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
        <div className="relative">
          <label className="block text-sm text-gray-700 mb-1">Connection No:</label>
          <input
            type="text"
            value={connectionQuery}
            onChange={(e) => onConnectionQueryChange(e.target.value)}
            placeholder="Type connection number or name"
            className="w-full px-3 py-2 border border-gray-400 rounded bg-white text-black"
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

      {/* Area Summary Card */}
      {selectedArea && displayPersons.length > 0 && !selectedPerson && (
        <div className="mb-6 p-4 bg-gray-100 border border-gray-300 rounded">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-sm text-gray-600">Total Customers:</span>
              <span className="text-xl font-bold text-black ml-2">{areaTotalCustomers}</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">Total Due from Area:</span>
              <span className="text-xl font-bold text-red-600 ml-2">Rs. {areaTotalDue.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* All Connections Table */}
      {displayPersons.length > 0 && !selectedPerson && (
        <div className="mb-6 border border-gray-300 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 border-b border-gray-300">Connection No</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 border-b border-gray-300">Customer Name</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 border-b border-gray-300">Area</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 border-b border-gray-300">Receipt No</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 border-b border-gray-300">Due Balance</th>
              </tr>
            </thead>
            <tbody>
              {displayPersons.map((person) => (
                <tr 
                  key={person._id} 
                  className="border-b border-gray-200 cursor-pointer hover:bg-gray-50"
                  onClick={() => onPersonSelect(person)}
                >
                  <td className="px-3 py-2 text-gray-700">{person.connectionNumber}</td>
                  <td className="px-3 py-2 text-gray-800">{person.name}</td>
                  <td className="px-3 py-2 text-gray-600">{getAreaName(person.areaId)}</td>
                  <td className="px-3 py-2 text-gray-600 font-mono text-xs">{person.receiptNo || "-"}</td>
                  <td className="px-3 py-2 text-right font-mono text-red-600">
                    {person.balance < 0 ? `Rs. ${Math.abs(person.balance).toFixed(2)}` : "0.00"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Single Customer View */}
      {selectedPerson && (
        <>
          <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div><span className="text-gray-500">Customer:</span> {selectedPerson.name}</div>
              <div><span className="text-gray-500">Connection:</span> {selectedPerson.connectionNumber}</div>
              <div><span className="text-gray-500">Area:</span> {getAreaName(selectedPerson.areaId)}</div>
              <div><span className="text-gray-500">Receipt No:</span> {selectedPerson.receiptNo || "-"}</div>
            </div>
          </div>

          <div className="mb-6 border border-gray-300 rounded overflow-hidden">
            <div className="px-3 py-2 bg-gray-100 border-b border-gray-300 text-xs text-gray-500">
              Transaction History (Oldest to Newest)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 border-b border-gray-300">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 border-b border-gray-300">Receipt No</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 border-b border-gray-300">Description</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 border-b border-gray-300">Amount</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 border-b border-gray-300">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">No transactions found</td></tr>
                  ) : (
                    transactions.map((transaction, idx) => {
                      const isBalanceNegative = transaction.runningBalance < 0;
                      const isAmountNegative = transaction.amountChange < 0;
                      return (
                        <tr key={transaction._id || idx} className="border-b border-gray-200">
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{transaction.date}</td>
                          <td className="px-3 py-2 text-gray-600 font-mono text-xs">{transaction.receiptNo}</td>
                          <td className="px-3 py-2 text-gray-700">{getTransactionType(transaction)}: {transaction.description}</td>
                          <td className={`px-3 py-2 text-right font-mono whitespace-nowrap ${isAmountNegative ? "text-red-600" : "text-green-600"}`}>
                            {isAmountNegative ? `- Rs. ${Math.abs(transaction.amountChange).toFixed(2)}` : `+ Rs. ${transaction.amountChange.toFixed(2)}`}
                          </td>
                          <td className={`px-3 py-2 text-right font-mono whitespace-nowrap ${isBalanceNegative ? "text-red-600" : "text-green-600"}`}>
                            {isBalanceNegative ? `- Rs. ${Math.abs(transaction.runningBalance).toFixed(2)}` : `Rs. ${transaction.runningBalance.toFixed(2)}`}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {transactions.length > 0 && (
                  <tfoot className="bg-gray-50 border-t border-gray-300">
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-right font-semibold text-gray-700">Current Balance:</td>
                      <td className={`px-3 py-2 text-right font-bold ${transactions[transactions.length - 1]?.runningBalance < 0 ? "text-red-600" : "text-green-600"}`}>
                        {transactions[transactions.length - 1]?.runningBalance < 0 
                          ? `- Rs. ${Math.abs(transactions[transactions.length - 1]?.runningBalance || 0).toFixed(2)}`
                          : `Rs. ${(transactions[transactions.length - 1]?.runningBalance || 0).toFixed(2)}`}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Payment Form */}
          <div className="border-t border-gray-300 pt-6 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Receipt No:</label>
                <input type="text" value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} placeholder="Enter receipt number" className="w-full px-3 py-2 border border-gray-400 rounded bg-white text-black" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Description:</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Enter description" className="w-full px-3 py-2 border border-gray-400 rounded bg-white text-black" />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-1">Cash Received:</label>
              <input ref={cashReceivedRef} type="number" value={cashReceived === "" ? "" : cashReceived} onChange={(e) => setCashReceived(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0.00" className="w-48 px-3 py-2 border border-gray-400 rounded bg-white text-black" />
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={savePayment} disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{saving ? "Saving..." : "Save Payment"}</button>
              <button onClick={printReceipt} disabled={printing || !selectedPerson} className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">{printing ? "Printing..." : "Print Receipt"}</button>
              <button onClick={() => { setSelectedPerson(null); setConnectionQuery(""); setReceiptNo(""); setCashReceived(""); setDescription(""); setTransactions([]); if (selectedArea) loadAreaPersons(selectedArea); }} className="px-6 py-2 bg-gray-400 text-white rounded hover:bg-gray-500">Clear</button>
            </div>
          </div>
        </>
      )}

      {/* Footer - Shows Total Due for Selected Area */}
      <div className="mt-6 pt-4 border-t border-gray-300">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-sm text-gray-500">Total Customers:</span>
            <span className="text-lg font-bold text-black ml-2">{areaTotalCustomers}</span>
          </div>
          <div>
            <span className="text-sm text-gray-500">Total Cash Receivable:</span>
            <span className="text-xl font-bold text-red-600 ml-2">Rs. {areaTotalDue.toFixed(2)}</span>
          </div>
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-3 pt-2 border-t border-gray-200">
          <span>F1 - Date</span>
          <span>F12 Back</span>
        </div>
      </div>
    </div>
  );
}