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
  const [paymentMonth, setPaymentMonth] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [loading, setLoading] = useState(true);
  const [connectionQuery, setConnectionQuery] = useState("");
  const [connectionSuggestions, setConnectionSuggestions] = useState<any[]>([]);
  const [outstandingBalance, setOutstandingBalance] = useState(0);
  const [lastReceiptNo, setLastReceiptNo] = useState("");

  const receiptRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  // Generate next receipt number
  const generateReceiptNo = async () => {
    if (!db) return "0001";

    try {
      const res = await db.localDB.allDocs({ include_docs: true });
      const payments = res.rows
        .map((r: any) => r.doc)
        .filter((d: any) => d && !d._deleted && d.type === "payment");

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
        setLastReceiptNo(nextReceipt);
        setReceiptNo(nextReceipt);
      } catch (e) {
        console.warn("failed to load areas/persons", e);
      }
      setLoading(false);
    };
    setup();
  }, []);

  // Calculate outstanding balance when person is selected
  useEffect(() => {
    const calculateBalance = async () => {
      if (!db || !selectedPersonId) {
        setOutstandingBalance(0);
        return;
      }

      try {
        const res = await db.localDB.allDocs({ include_docs: true });
        const docs = res.rows
          .map((r: any) => r.doc)
          .filter(
            (d: any) => d && !d._deleted && d.personId === selectedPersonId,
          );

        // Calculate expected monthly fees based on connection date
        const monthlyFee = Number(selectedPerson?.amount || 0);
        const connectionDate = new Date(selectedPerson?.createdAt);
        const currentDate = new Date();

        // Calculate how many months fees are due (from month after connection to current month)
        let monthsDue = 0;
        let feeDate = new Date(
          connectionDate.getFullYear(),
          connectionDate.getMonth() + 1,
          1,
        );
        const today = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          1,
        );

        while (feeDate <= today) {
          monthsDue++;
          feeDate.setMonth(feeDate.getMonth() + 1);
        }

        const expectedTotal = monthlyFee * monthsDue;

        // Total payments received
        const totalPayments = docs
          .filter((d: any) => d.type === "payment")
          .reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);

        // Total concessions
        const totalConcessions = docs
          .filter((d: any) => d.type === "credit-note")
          .reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);

        // Total purchases (debits)
        const totalPurchases = docs
          .filter((d: any) => d.type === "customer-debit")
          .reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);

        const balance =
          expectedTotal + totalPurchases - totalPayments - totalConcessions;
        setOutstandingBalance(Math.max(0, balance));
      } catch (e) {
        console.error("Failed to calculate balance", e);
      }
    };

    calculateBalance();
  }, [db, selectedPersonId, selectedPerson]);

  const onAreaChange = async (areaId: string) => {
    setSelectedArea(areaId);
    setSelectedPersonId("");
    setSelectedPerson(null);
    setConnectionQuery("");
    setConnectionSuggestions([]);
    setAmount("");
    setDescription("");
    setOutstandingBalance(0);
    const nextReceipt = await generateReceiptNo();
    setReceiptNo(nextReceipt);
  };

  const onPersonSelect = (person: any) => {
    setSelectedPersonId(person._id);
    setSelectedPerson(person);
    setConnectionQuery(String(person.connectionNumber ?? ""));
    setConnectionSuggestions([]);
    setTimeout(() => amountRef.current?.focus(), 100);
  };

  const onConnectionQueryChange = (q: string) => {
    setConnectionQuery(q);
    setSelectedPersonId("");
    setSelectedPerson(null);

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
    if (!selectedPerson) {
      alert("Please select a customer first");
      return;
    }
    if (amount === "" || Number(amount) <= 0) {
      alert("Please enter a valid amount");
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
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Payment Receipt</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; background: #fff; }
          .receipt { max-width: 400px; margin: 0 auto; border: 2px solid #333; border-radius: 10px; padding: 20px; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
          .urdu { font-family: 'Noto Nastaliq Urdu', 'Arial', sans-serif; direction: rtl; font-size: 20px; font-weight: bold; margin-bottom: 5px; }
          .title { font-size: 18px; font-weight: bold; color: #555; }
          .receipt-no { text-align: right; font-size: 12px; color: #666; margin-bottom: 15px; }
          .date { text-align: right; font-size: 12px; color: #666; margin-bottom: 20px; }
          .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; padding: 5px 0; border-bottom: 1px dashed #ddd; }
          .label { font-weight: bold; color: #555; }
          .value { color: #333; }
          .total { margin-top: 20px; padding-top: 15px; border-top: 2px solid #333; font-size: 18px; font-weight: bold; }
          .total .label, .total .value { font-size: 18px; }
          .footer { text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 11px; color: #888; }
          .thank-you { text-align: center; margin-top: 20px; font-style: italic; color: #555; }
          .balance { margin-top: 15px; padding: 10px; background: #f0f0f0; border-radius: 5px; text-align: center; }
          .balance .label { font-weight: bold; }
          .balance .value { font-weight: bold; font-size: 16px; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <div class="urdu">فیملی کیبل نیٹ ورک</div>
            <div class="title">CASH RECEIPT</div>
          </div>
          
          <div class="receipt-no">
            <strong>Receipt #:</strong> ${receiptNo}
          </div>
          
          <div class="date">
            <strong>Date:</strong> ${new Date().toLocaleDateString()} | <strong>Time:</strong> ${new Date().toLocaleTimeString()}
          </div>
          
          <div class="detail-row">
            <span class="label">Connection #:</span>
            <span class="value">${selectedPerson?.connectionNumber || "-"}</span>
          </div>
          
          <div class="detail-row">
            <span class="label">Customer Name:</span>
            <span class="value">${selectedPerson?.name || "-"}</span>
          </div>
          
          <div class="detail-row">
            <span class="label">Area:</span>
            <span class="value">${areaName}</span>
          </div>
          
          <div class="detail-row">
            <span class="label">Address:</span>
            <span class="value">${selectedPerson?.address || "-"}</span>
          </div>
          
          <div class="detail-row">
            <span class="label">Payment For Month:</span>
            <span class="value">${new Date(paymentMonth + "-01").toLocaleString("default", { month: "long", year: "numeric" })}</span>
          </div>
          
          <div class="detail-row">
            <span class="label">Description:</span>
            <span class="value">${description || "Monthly Fee Payment"}</span>
          </div>
          
          <div class="total">
            <span class="label">Amount Received:</span>
            <span class="value">Rs. ${Number(amount).toFixed(2)}</span>
          </div>
          
          <div class="balance">
            <span class="label">Outstanding Balance:</span>
            <span class="value" style="color: ${outstandingBalance - Number(amount) > 0 ? "#dc2626" : "#16a34a"}">
              Rs. ${Math.max(0, outstandingBalance - Number(amount)).toFixed(2)}
            </span>
          </div>
          
          <div class="thank-you">
            Thank you for your payment!
          </div>
          
          <div class="footer">
            <p>This is a computer generated receipt</p>
            <p>No signature required</p>
            <p>Please keep this receipt for future reference</p>
          </div>
        </div>
        <script>
          window.onload = function() { 
            window.print(); 
            setTimeout(function() { window.close(); }, 1000);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const addPayment = async () => {
    if (!db || !selectedPersonId) {
      alert("Please select a connection number (person)");
      return;
    }
    if (!receiptNo.trim()) {
      alert("Please enter a receipt number");
      return;
    }
    if (amount === "" || Number(amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    if (!description.trim()) {
      alert("Please enter a description");
      return;
    }

    try {
      const now = new Date().toISOString();

      const paymentDoc = {
        _id: `payment_${selectedPersonId}_${Date.now()}`,
        type: "payment",
        areaId: selectedArea,
        personId: selectedPersonId,
        connectionNumber: connectionQuery,
        personName: selectedPerson?.name,
        personAddress: selectedPerson?.address,
        receiptNo: receiptNo.trim(),
        amount: Number(amount),
        description: description.trim(),
        paymentMonth: paymentMonth,
        createdAt: now,
      };

      await db.localDB.put(paymentDoc);

      // Print receipt after successful save
      printReceipt();

      // Generate next receipt number
      const nextReceipt = await generateReceiptNo();
      setReceiptNo(nextReceipt);

      // Clear form
      setAmount("");
      setDescription("");

      // Refresh balance
      const res = await db.localDB.allDocs({ include_docs: true });
      const docs = res.rows
        .map((r: any) => r.doc)
        .filter(
          (d: any) => d && !d._deleted && d.personId === selectedPersonId,
        );

      const monthlyFee = Number(selectedPerson?.amount || 0);
      const connectionDate = new Date(selectedPerson?.createdAt);
      const currentDate = new Date();

      let monthsDue = 0;
      let feeDate = new Date(
        connectionDate.getFullYear(),
        connectionDate.getMonth() + 1,
        1,
      );
      const today = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1,
      );

      while (feeDate <= today) {
        monthsDue++;
        feeDate.setMonth(feeDate.getMonth() + 1);
      }

      const expectedTotal = monthlyFee * monthsDue;

      const totalPayments = docs
        .filter((d: any) => d.type === "payment")
        .reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);

      const totalConcessions = docs
        .filter((d: any) => d.type === "credit-note")
        .reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);

      const totalPurchases = docs
        .filter((d: any) => d.type === "customer-debit")
        .reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);

      const balance =
        expectedTotal + totalPurchases - totalPayments - totalConcessions;
      setOutstandingBalance(Math.max(0, balance));
    } catch (e: any) {
      console.error(e);
      alert("Failed to save payment: " + e.message);
    }
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
        <h1 className="text-2xl font-bold text-black">
          Cash Received From Customer
        </h1>
        <p className="text-sm text-gray-600">
          Record payments and print receipt
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
              onChange={(e) => onConnectionQueryChange(e.target.value)}
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

        {/* Selected Person Details */}
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
                Outstanding Balance
              </label>
              <div
                className={`text-sm font-bold ${outstandingBalance > 0 ? "text-red-600" : "text-green-600"}`}
              >
                Rs.{outstandingBalance.toFixed(2)}
              </div>
            </div>
          </div>
        )}

        {/* Receipt Number */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Receipt Number <span className="text-red-500">*</span>
          </label>
          <input
            ref={receiptRef}
            type="text"
            value={receiptNo}
            onChange={(e) => setReceiptNo(e.target.value)}
            placeholder="Auto-generated receipt number"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black bg-blue-50"
          />
          <p className="text-xs text-gray-400 mt-1">
            Auto-generated sequential number
          </p>
        </div>

        {/* Payment Month */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment For Month
          </label>
          <input
            type="month"
            value={paymentMonth}
            onChange={(e) => setPaymentMonth(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
          />
        </div>

        {/* Amount and Description */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount Received (Rs.) <span className="text-red-500">*</span>
            </label>
            <input
              ref={amountRef}
              type="number"
              value={amount === "" ? "" : amount}
              onChange={(e) =>
                setAmount(e.target.value === "" ? "" : Number(e.target.value))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  descRef.current?.focus();
                }
              }}
              placeholder="0.00"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              ref={descRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  addPayment();
                }
              }}
              placeholder="e.g., Payment for monthly fee, Partial payment..."
              rows={1}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black resize-none"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={addPayment}
            disabled={!selectedPersonId}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-700 text-white rounded-lg hover:from-blue-700 hover:to-purple-800 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Record Payment & Print Receipt
          </button>
          {selectedPersonId && amount !== "" && Number(amount) > 0 && (
            <button
              onClick={printReceipt}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-teal-700 text-white rounded-lg hover:from-green-700 hover:to-teal-800 transition-all font-semibold"
            >
              Print Receipt Only
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
