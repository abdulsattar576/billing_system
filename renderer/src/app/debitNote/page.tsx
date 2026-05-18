"use client";
import { useEffect, useRef, useState } from "react";
import { initDB } from "../services/db";

export default function CashReceivedPage() {
  const [db, setDb] = useState<any>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const [allPersons, setAllPersons] = useState<any[]>([]);
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [receiptNo, setReceiptNo] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectionQuery, setConnectionQuery] = useState("");
  const [connectionSuggestions, setConnectionSuggestions] = useState<any[]>([]);
  const [customerBalance, setCustomerBalance] = useState(0);
  const [pendingMonths, setPendingMonths] = useState<any[]>([]);
  const [lastSavedPayment, setLastSavedPayment] = useState<any>(null);

  const receiptRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const generateReceiptNo = async () => {
    if (!db) return "0001";
    try {
      const res = await db.localDB.allDocs({ include_docs: true });
      const payments = res.rows
        .map((r: any) => r.doc)
        .filter((d: any) => d && !d._deleted && (d.type === "payment" || d.type === "debit-payment"));
      const maxReceiptNo = payments.reduce((max: number, p: any) => {
        const num = parseInt(p.receiptNo, 10);
        return !isNaN(num) && num > max ? num : max;
      }, 0);
      return String(maxReceiptNo + 1).padStart(4, "0");
    } catch (e) {
      return "0001";
    }
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
        const nextReceipt = await generateReceiptNo();
        setReceiptNo(nextReceipt);
      } catch (e) {
        console.warn("failed to load areas/persons", e);
      }
      setLoading(false);
    };
    setup();
  }, []);

  // Refresh balance and pending months using db service
  const refreshCustomerData = async (personId: string) => {
    if (!db || !personId) return;
    try {
      const balance = await db.calculateCustomerBalance(personId);
      const pending = await db.getPendingMonths(personId);
      setCustomerBalance(balance);
      setPendingMonths(pending);
    } catch (e) {
      console.error("Failed to refresh customer data", e);
    }
  };

  useEffect(() => {
    if (selectedPersonId) {
      refreshCustomerData(selectedPersonId);
    }
  }, [db, selectedPersonId]);

  const onAreaChange = async (areaId: string) => {
    setSelectedArea(areaId);
    setSelectedPersonId("");
    setSelectedPerson(null);
    setConnectionQuery("");
    setConnectionSuggestions([]);
    setAmount("");
    setDescription("");
    setCustomerBalance(0);
    setPendingMonths([]);
    setLastSavedPayment(null);
    const nextReceipt = await generateReceiptNo();
    setReceiptNo(nextReceipt);
  };

  const onPersonSelect = (person: any) => {
    setSelectedPersonId(person._id);
    setSelectedPerson(person);
    setConnectionQuery(String(person.connectionNumber ?? ""));
    setConnectionSuggestions([]);
    setLastSavedPayment(null);
    setTimeout(() => amountRef.current?.focus(), 100);
  };

  const onConnectionQueryChange = (q: string) => {
    setConnectionQuery(q);
    setSelectedPersonId("");
    setSelectedPerson(null);
    setLastSavedPayment(null);
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

  const printReceipt = () => {
    if (!lastSavedPayment) {
      alert("No payment to print. Please save a payment first.");
      return;
    }

    const areaName = areas.find((a) => a._id === selectedArea)?.name || "";
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) {
      alert("Please allow pop-ups to print receipt");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Payment Receipt</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; }
          .receipt { max-width: 400px; margin: 0 auto; border: 2px solid #333; border-radius: 10px; padding: 20px; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
          .urdu { font-family: 'Noto Nastaliq Urdu', Arial; direction: rtl; font-size: 20px; font-weight: bold; }
          .title { font-size: 18px; font-weight: bold; color: #555; }
          .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; padding: 5px 0; border-bottom: 1px dashed #ddd; }
          .label { font-weight: bold; }
          .total { margin-top: 20px; padding-top: 15px; border-top: 2px solid #333; font-size: 18px; font-weight: bold; }
          .balance { margin-top: 15px; padding: 10px; background: #f0f0f0; border-radius: 5px; text-align: center; }
          .footer { text-align: center; margin-top: 30px; font-size: 11px; color: #888; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <div class="urdu">فیملی کیبل نیٹ ورک</div>
            <div class="title">CASH RECEIPT</div>
          </div>
          <div class="detail-row"><span class="label">Receipt #:</span><span>${lastSavedPayment.receiptNo}</span></div>
          <div class="detail-row"><span class="label">Date:</span><span>${new Date().toLocaleString()}</span></div>
          <div class="detail-row"><span class="label">Connection #:</span><span>${selectedPerson?.connectionNumber}</span></div>
          <div class="detail-row"><span class="label">Customer Name:</span><span>${selectedPerson?.name}</span></div>
          <div class="detail-row"><span class="label">Area:</span><span>${areaName}</span></div>
          <div class="detail-row"><span class="label">Address:</span><span>${selectedPerson?.address}</span></div>
          <div class="detail-row"><span class="label">Paid Months:</span><span>${lastSavedPayment.paidMonths.join(", ")}</span></div>
          ${lastSavedPayment.debitAmount > 0 ? `<div class="detail-row"><span class="label">Debit Payment:</span><span>Rs. ${lastSavedPayment.debitAmount.toFixed(2)}</span></div>` : ""}
          <div class="total"><span class="label">Total Amount:</span><span>Rs. ${lastSavedPayment.totalAmount.toFixed(2)}</span></div>
          <div class="balance"><span class="label">New Balance:</span><span>${lastSavedPayment.newBalance >= 0 ? `Rs. ${lastSavedPayment.newBalance.toFixed(2)}` : `-Rs. ${Math.abs(lastSavedPayment.newBalance).toFixed(2)}`}</span></div>
          <div class="footer">Thank you for your payment!</div>
        </div>
        <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1000)}</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const savePayment = async () => {
    if (!db || !selectedPersonId) {
      alert("Please select a customer");
      return;
    }
    if (!receiptNo.trim()) {
      alert("Please enter receipt number");
      return;
    }
    if (amount === "" || Number(amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    setSaving(true);
    let remainingAmount = Number(amount);
    const paidMonths: string[] = [];
    let debitPayment = 0;

    try {
      // Step 1: FIRST deduct pending monthly fees (oldest first)
      for (const month of pendingMonths) {
        if (remainingAmount >= month.amount) {
          // Full month paid
          const paymentDoc = {
            _id: `payment_${selectedPersonId}_${month.month}_${Date.now()}`,
            type: "payment",
            areaId: selectedArea,
            personId: selectedPersonId,
            connectionNumber: connectionQuery,
            personName: selectedPerson?.name,
            personAddress: selectedPerson?.address,
            receiptNo: receiptNo.trim(),
            amount: month.amount,
            description: `Monthly fee payment for ${month.monthName}`,
            paymentMonth: month.month,
            createdAt: new Date().toISOString(),
          };
          await db.localDB.put(paymentDoc);
          paidMonths.push(month.monthName);
          remainingAmount -= month.amount;
        } else if (remainingAmount > 0) {
          // Partial month payment
          const paymentDoc = {
            _id: `payment_${selectedPersonId}_${month.month}_${Date.now()}`,
            type: "payment",
            areaId: selectedArea,
            personId: selectedPersonId,
            connectionNumber: connectionQuery,
            personName: selectedPerson?.name,
            personAddress: selectedPerson?.address,
            receiptNo: receiptNo.trim(),
            amount: remainingAmount,
            description: `Partial payment for ${month.monthName}`,
            paymentMonth: month.month,
            createdAt: new Date().toISOString(),
          };
          await db.localDB.put(paymentDoc);
          paidMonths.push(`${month.monthName} (Partial)`);
          remainingAmount = 0;
          break;
        } else {
          break;
        }
      }

      // Step 2: SECOND remaining amount goes to debit (udhar) balance
      if (remainingAmount > 0) {
        debitPayment = remainingAmount;
        const debitPaymentDoc = {
          _id: `debit_payment_${selectedPersonId}_${Date.now()}`,
          type: "debit-payment",
          areaId: selectedArea,
          personId: selectedPersonId,
          connectionNumber: connectionQuery,
          personName: selectedPerson?.name,
          personAddress: selectedPerson?.address,
          receiptNo: receiptNo.trim(),
          amount: remainingAmount,
          description: description.trim() || "Payment towards outstanding debit balance",
          createdAt: new Date().toISOString(),
        };
        await db.localDB.put(debitPaymentDoc);
      }

      // Step 3: Refresh balance from database (this ensures consistency)
      await refreshCustomerData(selectedPersonId);

      // Store saved payment details for printing
      setLastSavedPayment({
        receiptNo: receiptNo,
        paidMonths: paidMonths,
        debitAmount: debitPayment,
        totalAmount: Number(amount),
        newBalance: customerBalance + Number(amount), // Payment increases balance
      });

      // Generate next receipt number
      const nextReceipt = await generateReceiptNo();
      setReceiptNo(nextReceipt);
      setAmount("");
      setDescription("");
      
      const balanceStatus = customerBalance + Number(amount);
      alert(`✅ Payment saved successfully!\n\n📌 Paid Months: ${paidMonths.join(", ")}\n💰 Debit Payment: Rs. ${debitPayment.toFixed(2)}\n📊 New Balance: ${balanceStatus >= 0 ? `Rs. ${balanceStatus.toFixed(2)}` : `-Rs. ${Math.abs(balanceStatus).toFixed(2)}`}`);
      
    } catch (e: any) {
      console.error(e);
      alert("Failed to save payment: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const formatBalance = (balance: number) => {
    if (balance === 0) return "Rs. 0";
    if (balance < 0) return `-Rs. ${Math.abs(balance).toFixed(2)}`;
    return `Rs. ${balance.toFixed(2)}`;
  };

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
        <h1 className="text-2xl font-bold text-black">Cash Received From Customer</h1>
        <p className="text-sm text-gray-600">Positive balance = Customer has credit | Negative balance = Customer owes (Udhari)</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-xs text-gray-500">Customer Name</label>
                <div className="text-sm font-medium text-black">{selectedPerson.name}</div>
              </div>
              <div>
                <label className="block text-xs text-gray-500">Monthly Fee</label>
                <div className="text-sm font-medium text-black">Rs.{Number(selectedPerson.amount || 0).toFixed(2)}</div>
              </div>
              <div>
                <label className="block text-xs text-gray-500">Current Balance</label>
                <div className={`text-sm font-bold ${customerBalance < 0 ? "text-red-600" : customerBalance > 0 ? "text-green-600" : "text-gray-600"}`}>
                  {formatBalance(customerBalance)}
                </div>
                {customerBalance < 0 && <p className="text-xs text-red-500 mt-1">⚠ Customer owes this amount</p>}
                {customerBalance > 0 && <p className="text-xs text-green-500 mt-1">✓ Customer has credit</p>}
                {customerBalance === 0 && <p className="text-xs text-gray-500 mt-1">✓ Balance is zero</p>}
              </div>
            </div>

            {/* Pending Months - Shows which months are not paid */}
            {pendingMonths.length > 0 && (
              <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
                <h3 className="text-sm font-semibold text-red-800 mb-2">⚠ Pending Monthly Fees (Udhari)</h3>
                <div className="space-y-1">
                  {pendingMonths.map((month, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{month.monthName}</span>
                      <span className="font-medium text-red-600">Rs. {month.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-red-600 mt-2">
                  ⚠ Payment will FIRST clear these pending months, then remaining goes to debit balance
                </p>
              </div>
            )}
          </>
        )}

        {/* Receipt Number */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Receipt Number</label>
          <input
            ref={receiptRef}
            type="text"
            value={receiptNo}
            onChange={(e) => setReceiptNo(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black bg-blue-50"
          />
        </div>

        {/* Amount */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Amount Received (Rs.)</label>
          <input
            ref={amountRef}
            type="number"
            value={amount === "" ? "" : amount}
            onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="0.00"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
          />
        </div>

        {/* Description */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Additional notes..."
            rows={2}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black resize-none"
          />
        </div>

        {/* Payment Allocation Preview */}
        {selectedPerson && amount !== "" && Number(amount) > 0 && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">💰 Payment Allocation Preview</h3>
            {(() => {
              let remaining = Number(amount);
              const allocation = [];
              let tempBalance = customerBalance;
              
              for (const month of pendingMonths) {
                if (remaining >= month.amount) {
                  allocation.push({ month: month.monthName, amount: month.amount, type: "✅ Monthly Fee (Cleared)" });
                  remaining -= month.amount;
                  tempBalance += month.amount;
                } else if (remaining > 0) {
                  allocation.push({ month: month.monthName, amount: remaining, type: "⚠️ Monthly Fee (Partial)" });
                  tempBalance += remaining;
                  remaining = 0;
                  break;
                } else {
                  break;
                }
              }
              if (remaining > 0) {
                allocation.push({ month: "Debit Balance (Udhar)", amount: remaining, type: "💰 Debit Payment" });
                tempBalance += remaining;
              }
              
              return (
                <div className="space-y-2">
                  {allocation.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{item.month}</span>
                      <span className="font-medium">Rs. {item.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="mt-3 pt-2 border-t border-blue-200">
                    <div className="flex justify-between text-sm font-bold">
                      <span>Current Balance:</span>
                      <span className={customerBalance < 0 ? "text-red-600" : "text-green-600"}>
                        {formatBalance(customerBalance)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-bold">
                      <span>After Payment:</span>
                      <span className={tempBalance < 0 ? "text-red-600" : "text-green-600"}>
                        {formatBalance(tempBalance)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={savePayment}
            disabled={!selectedPersonId || saving}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-700 text-white rounded-lg hover:from-blue-700 hover:to-purple-800 transition-all font-semibold disabled:opacity-50"
          >
            {saving ? "Saving..." : "💾 Save Payment"}
          </button>
          <button
            onClick={printReceipt}
            disabled={!lastSavedPayment}
            className="px-6 py-3 bg-gradient-to-r from-green-600 to-teal-700 text-white rounded-lg hover:from-green-700 hover:to-teal-800 transition-all font-semibold disabled:opacity-50"
          >
            🖨️ Print Receipt
          </button>
        </div>
        
        {lastSavedPayment && (
          <p className="text-xs text-green-600 mt-3 text-center">
            ✓ Last payment saved. Click Print Receipt to reprint.
          </p>
        )}
      </div>
    </div>
  );
}