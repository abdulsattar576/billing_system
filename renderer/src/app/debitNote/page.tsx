"use client";
import React, { useEffect, useRef, useState } from "react";
import { initDB } from "../services/db";

export default function CashReceivedPage() {
  const [db, setDb] = useState<any>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const [selectedArea, setSelectedArea] = useState("");
  const [personsInArea, setPersonsInArea] = useState<any[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [selectedPersonName, setSelectedPersonName] = useState("");
  const [selectedPersonAddress, setSelectedPersonAddress] = useState("");
  const [selectedPersonFee, setSelectedPersonFee] = useState<number | "">("");
  const [selectedPersonReceiptNo, setSelectedPersonReceiptNo] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [receiptNo, setReceiptNo] = useState("");
  const [description, setDescription] = useState("");
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionQuery, setConnectionQuery] = useState("");
  const [connectionSuggestions, setConnectionSuggestions] = useState<any[]>([]);
  const [displayPersons, setDisplayPersons] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);

  const receiptRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);
  const connectionRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLSelectElement>(null);

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

  const calculatePersonBalance = async (personId: string) => {
    if (!db) return 0;
    try {
      const balance = await db.calculateCustomerBalance(personId);
      return balance;
    } catch (e) {
      return 0;
    }
  };

  const onAreaChange = async (areaId: string) => {
    setSelectedArea(areaId);
    setSelectedPersonId("");
    setSelectedPersonName("");
    setSelectedPersonAddress("");
    setSelectedPersonFee("");
    setSelectedPersonReceiptNo("");
    setAmount("");
    setReceiptNo("");
    setDescription("");
    setRecords([]);
    setConnectionQuery("");
    setConnectionSuggestions([]);
    setDisplayPersons([]);

    if (!db || !areaId) return;
    try {
      const p = await db.getPersonsByArea(areaId);
      setPersonsInArea(p || []);

      const personsWithBalance = await Promise.all(
        p.map(async (person: any) => ({
          ...person,
          balance: await calculatePersonBalance(person._id),
        })),
      );
      setDisplayPersons(personsWithBalance);
      await loadRecords(areaId);
    } catch (e) {
      console.warn("failed to load persons/records", e);
    }
  };

  const onPersonSelect = async (person: any) => {
    setSelectedPersonId(person._id);
    setSelectedPersonName(person?.name || "");
    setSelectedPersonAddress(person?.address || "");
    setSelectedPersonFee(person?.amount || "");
    setSelectedPersonReceiptNo(person?.receiptNo || "");
    setConnectionQuery(String(person.connectionNumber ?? ""));
    setConnectionSuggestions([]);
    setReceiptNo("");
    setDescription("");

    const balance = await calculatePersonBalance(person._id);
    setDisplayPersons([{ ...person, balance }]);
    await loadRecords(person.areaId || selectedArea, person._id);

    if (person.amount && !amount) {
      setAmount(person.amount);
    }
    setTimeout(() => receiptRef.current?.focus(), 100);
  };

  const loadRecords = async (areaId: string, personId?: string) => {
    if (!db || !areaId) return;
    try {
      if (typeof db.getCashReceivedRecords === "function") {
        const paymentRecords = await db.getCashReceivedRecords(areaId, personId);
        setRecords(paymentRecords || []);
        return;
      }

      await db.localDB.createIndex({ index: { fields: ["type", "areaId", "personId"] } });
      const selector: any = { type: "payment", areaId };
      if (personId) selector.personId = personId;

      const res = await db.localDB.find({
        selector,
        limit: 10000,
      });

      setRecords(
        (res.docs || []).sort((a: any, b: any) => {
          const aDate = String(a.date || a.createdAt || "");
          const bDate = String(b.date || b.createdAt || "");
          if (aDate === bDate) {
            return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
          }
          return bDate.localeCompare(aDate);
        }),
      );
    } catch (e) {
      console.warn("failed to load records", e);
    }
  };

  const addRecord = async () => {
    if (!db || !selectedPersonId) {
      alert("Please select a customer");
      return;
    }
    if (!receiptNo.trim()) {
      alert("Please enter Receipt Number");
      return;
    }
    if (amount === "" || Number(amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    if (!description.trim()) {
      alert("Please enter Description");
      return;
    }

    setSaving(true);

    try {
      let savedPayment: any;
      let newBalance = 0;

      if (typeof db.createCashPayment === "function") {
        const result = await db.createCashPayment({
          personId: selectedPersonId,
          receiptNo: receiptNo.trim(),
          amount: Number(amount),
          description: description.trim(),
        });

        savedPayment = result.payment;
        newBalance = result.balance;
      } else {
        const now = new Date();
        const todayDate = now.toISOString().slice(0, 10);
        const paymentDoc = {
          _id: `payment_${selectedPersonId}_${Date.now()}`,
          type: "payment",
          areaId: selectedArea,
          personId: selectedPersonId,
          connectionNumber: connectionQuery,
          personName: selectedPersonName,
          personAddress: selectedPersonAddress,
          personMonthlyFee: Number(selectedPersonFee || 0),
          receiptNo: receiptNo.trim(),
          amount: Number(amount),
          description: description.trim(),
          date: todayDate,
          month: todayDate.slice(0, 7),
          createdAt: now.toISOString(),
        };

        await db.localDB.put(paymentDoc);
        newBalance = await calculatePersonBalance(selectedPersonId);
        savedPayment = { ...paymentDoc, balance: newBalance, remainingAfterPayment: newBalance };
      }

      await loadRecords(selectedArea, selectedPersonId);

      const person =
        personsInArea.find((p) => p._id === selectedPersonId) ||
        (await db.localDB.get(selectedPersonId));

      const updatedPerson = {
        ...person,
        balance: newBalance,
        currentBalance: newBalance,
      };

      setDisplayPersons([updatedPerson]);

      setAmount("");
      setReceiptNo("");
      setDescription("");

      alert(
        `Payment saved successfully!\n\nCustomer: ${selectedPersonName}\nReceipt Number: ${savedPayment?.receiptNo || receiptNo}\nAmount: Rs. ${Number(savedPayment?.amount || amount).toFixed(2)}`,
      );
    } catch (e: any) {
      alert("Failed to save: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async (record: any) => {
    if (!db) return;

    if (!selectedPersonId || record.type !== "payment") {
      alert("Only payment records can be deleted from this page.");
      return;
    }

    if (!confirm(`Delete transaction for ${record.personName}?`)) return;

    try {
      const latest = await db.localDB.get(record._id);
      await db.localDB.remove(latest);

      if (typeof db.recalculateAndUpdatePersonBalance === "function") {
        await db.recalculateAndUpdatePersonBalance(record.personId);
      }

      await loadRecords(selectedArea, selectedPersonId);
      const balance = await calculatePersonBalance(selectedPersonId);
      const person = personsInArea.find((p) => p._id === selectedPersonId);
      if (person) setDisplayPersons([{ ...person, balance }]);

      alert("Payment deleted successfully.");
    } catch (e: any) {
      alert("Failed to delete: " + e.message);
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    nextRef: React.RefObject<HTMLInputElement | null>,
  ) => {
    if ((e.key === "Tab" || e.key === "Enter") && !e.shiftKey) {
      e.preventDefault();
      nextRef.current?.focus();
    }
  };

  const formatAmount = (value: any) => `Rs. ${Number(value || 0).toFixed(2)}`;

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

  const printRecords = () => {
    if (records.length === 0) {
      alert("No records to print");
      return;
    }

    setPrinting(true);
    const printWindow = window.open("", "", "width=1200,height=700");
    if (!printWindow) {
      setPrinting(false);
      return;
    }

    const areaName = areas.find((a) => a._id === selectedArea)?.name || "All Areas";
    const recordsToPrint = selectedPersonId
      ? records.filter((r) => r.personId === selectedPersonId)
      : records;

    const totalReceived = recordsToPrint.reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0,
    );

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Family Cable Network - Cash Received</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; color: #111827; }
          h1 { text-align: center; margin-bottom: 10px; font-size: 24px; }
          .meta { margin-bottom: 20px; font-size: 13px; color: #4b5563; }
          .summary { margin-top: 15px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          thead { background-color: #f3f4f6; }
          th { padding: 10px; text-align: left; font-weight: bold; border: 1px solid #d1d5db; font-size: 12px; }
          td { padding: 9px 10px; border: 1px solid #e5e7eb; font-size: 12px; }
          .amount { text-align: right; }
          .balance { text-align: right; font-weight: bold; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        <h1>Family Cable Network</h1>
        <div class="meta">
          <div><strong>Report:</strong> Cash Received</div>
          <div><strong>Area:</strong> ${areaName}</div>
          ${selectedPersonName ? `<div><strong>Customer:</strong> ${selectedPersonName} (${connectionQuery})</div>` : ""}
          <div><strong>Printed:</strong> ${new Date().toLocaleString()}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Receipt No</th>
              <th>Connection #</th>
              <th>Person</th>
              <th>Address</th>
              <th>Description</th>
              <th class="amount">Amount Received</th>
              <th class="balance">Balance</th>
            </tr>
          </thead>
          <tbody>
            ${recordsToPrint
              .map(
                (r) => `
              <tr>
                <td>${r.date || (r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "-")}</td>
                <td>${r.receiptNo || "-"}</td>
                <td>${r.connectionNumber || "-"}</td>
                <td>${r.personName || "-"}</td>
                <td>${r.personAddress || "-"}</td>
                <td>${r.description || "-"}</td>
                <td class="amount">${formatAmount(r.amount)}</td>
                <td class="balance">${formatBalance(r.balance ?? r.remainingAfterPayment)}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
        <div class="summary">Total Received: ${formatAmount(totalReceived)}</div>
        <script>window.print();</script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setPrinting(false);
  };

  const filteredConnectionSuggestions = connectionSuggestions;

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-black">
          Cash Received From Customer
        </h1>
        <p className="text-sm text-gray-600">
          Enter received amounts per person. Payment date is created automatically.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Area
            </label>
            <select
              ref={areaRef}
              value={selectedArea}
              onChange={(e) => onAreaChange(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
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
              Connection No
            </label>
            <div className="relative">
              <input
                ref={connectionRef}
                type="text"
                value={connectionQuery}
                onChange={(e) => {
                  const q = String(e.target.value || "");
                  setConnectionQuery(q);
                  if (!q || !selectedArea) {
                    setConnectionSuggestions([]);
                    return;
                  }
                  const qLower = q.toLowerCase();
                  const filtered = personsInArea.filter((p) => {
                    const conn = String(p.connectionNumber ?? "").toLowerCase();
                    const name = String(p.name ?? "").toLowerCase();
                    return conn.includes(qLower) || name.includes(qLower);
                  });
                  setConnectionSuggestions(filtered.slice(0, 20));
                }}
                onFocus={() => {
                  if (selectedArea && connectionQuery) {
                    const qLower = connectionQuery.toLowerCase();
                    const filtered = personsInArea.filter((p) => {
                      const conn = String(p.connectionNumber ?? "").toLowerCase();
                      const name = String(p.name ?? "").toLowerCase();
                      return conn.includes(qLower) || name.includes(qLower);
                    });
                    setConnectionSuggestions(filtered.slice(0, 20));
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (filteredConnectionSuggestions.length > 0) {
                      onPersonSelect(filteredConnectionSuggestions[0]);
                    } else if (selectedPersonId) {
                      receiptRef.current?.focus();
                    }
                  }
                }}
                placeholder="Type connection #"
                disabled={!selectedArea}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black disabled:bg-gray-50"
              />

              {filteredConnectionSuggestions.length > 0 && (
                <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded max-h-44 overflow-auto shadow-lg">
                  {filteredConnectionSuggestions.map((p) => (
                    <li
                      key={p._id}
                      onClick={() => onPersonSelect(p)}
                      className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-black"
                    >
                      #{p.connectionNumber} - {p.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Person Name
            </label>
            <input
              type="text"
              value={selectedPersonName}
              readOnly
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Address
            </label>
            <input
              type="text"
              value={selectedPersonAddress}
              readOnly
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monthly Fee
            </label>
            <input
              type="text"
              value={
                selectedPersonFee === ""
                  ? ""
                  : `Rs. ${Number(selectedPersonFee).toFixed(2)}`
              }
              readOnly
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-black"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Receipt No
            </label>
            <input
              ref={receiptRef}
              type="text"
              value={receiptNo}
              onChange={(e) => setReceiptNo(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, amountRef)}
              placeholder="Enter receipt number"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount Received (Rs.)
            </label>
            <input
              ref={amountRef}
              type="number"
              value={amount === "" ? "" : amount}
              onChange={(e) =>
                setAmount(e.target.value === "" ? "" : Number(e.target.value))
              }
              onKeyDown={(e) => handleKeyDown(e, descriptionRef)}
              placeholder="0.00"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <input
              ref={descriptionRef}
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addRecord();
                }
              }}
              placeholder="Enter description"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-black"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={addRecord}
              disabled={saving || !selectedPersonId}
              className="px-4 py-3 flex-1 bg-gradient-to-r from-blue-600 to-purple-700 text-white text-sm rounded-lg hover:from-blue-700 hover:to-purple-800 transition-colors duration-200 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Payment"}
            </button>
            <button
              onClick={printRecords}
              disabled={records.length === 0}
              className="px-4 py-3 flex-1 bg-gradient-to-r from-green-600 to-teal-700 text-white text-sm rounded-lg hover:from-green-700 hover:to-teal-800 transition-colors duration-200 disabled:opacity-50"
            >
              {printing ? "Printing..." : "Print"}
            </button>
          </div>
        </div>

        {selectedPersonId && displayPersons.length > 0 && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="text-xs text-gray-600">Current Balance</div>
              <div
                className={`text-lg font-semibold ${getBalanceClass(displayPersons[0]?.balance)}`}
              >
                {formatBalance(displayPersons[0]?.balance)}
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="text-xs text-gray-600">Selected Customer</div>
              <div className="text-lg font-semibold text-blue-700">
                {selectedPersonName || "-"}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Cash Received Records</h2>

          {records.length > 0 && (
            <button
              onClick={printRecords}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition"
            >
              Print List
            </button>
          )}
        </div>

        {records.length === 0 ? (
          <div className="text-sm text-gray-500">No payment records found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Receipt No
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Connection #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Person
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Description
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Amount Received
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Balance
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {records.map((row: any) => (
                  <tr key={row._id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-500">
                      {row.date || (row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "-")}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-900">
                      {row.receiptNo || "-"}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-900">
                      {row.connectionNumber || "-"}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-900">
                      {row.personName || "-"}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500">
                      {row.personAddress || "-"}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500">
                      {row.description || "-"}
                    </td>
                    <td className="px-6 py-3 text-sm text-right font-medium text-green-700">
                      + {formatAmount(row.amount)}
                    </td>
                    <td
                      className={`px-6 py-3 text-sm text-right font-mono ${getBalanceClass(row.balance ?? row.remainingAfterPayment)}`}
                    >
                      {formatBalance(row.balance ?? row.remainingAfterPayment)}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => deleteRecord(row)}
                        className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        Delete
                      </button>
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
