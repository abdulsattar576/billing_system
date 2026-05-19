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

  // Refs for form inputs
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

      // Load all persons with balances
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

    // Show only this person in the table
    const balance = await calculatePersonBalance(person._id);
    setDisplayPersons([{ ...person, balance }]);

    if (person.amount && !amount) {
      setAmount(person.amount);
    }
    setTimeout(() => receiptRef.current?.focus(), 100);
  };

  const loadRecords = async (areaId: string) => {
    if (!db) return;
    try {
      await db.localDB.createIndex({ index: { fields: ["type", "areaId"] } });
      const res = await db.localDB.find({
        selector: { type: "debit", areaId },
      });
      setRecords(res.docs || []);
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

    setSaving(true);
    const now = new Date();
    const todayDate = now.toISOString().slice(0, 10);

    try {
      const paymentDoc = {
        _id: `payment_${selectedPersonId}_${Date.now()}`,
        type: "payment",
        areaId: selectedArea,
        personId: selectedPersonId,
        connectionNumber: connectionQuery,
        personName: selectedPersonName,
        personAddress: selectedPersonAddress,
        receiptNo: receiptNo.trim(),
        amount: Number(amount),
        description: description.trim() || "Cash received",
        date: todayDate,
        createdAt: now.toISOString(),
      };
      await db.localDB.put(paymentDoc);

      // Refresh balance for this person
      const newBalance = await calculatePersonBalance(selectedPersonId);
      const updatedPerson = {
        _id: selectedPersonId,
        name: selectedPersonName,
        connectionNumber: connectionQuery,
        receiptNo: selectedPersonReceiptNo,
        address: selectedPersonAddress,
        amount: selectedPersonFee,
        balance: newBalance,
      };
      setDisplayPersons([updatedPerson]);

      setAmount("");
      setReceiptNo("");
      setDescription("");

      alert(
        `Payment saved successfully!\n\nCustomer: ${selectedPersonName}\nReceipt Number: ${receiptNo}\nAmount: Rs. ${Number(amount).toFixed(2)}`,
      );
    } catch (e: any) {
      alert("Failed to save: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async (record: any) => {
    if (!db) return;
    if (!confirm(`Delete transaction for ${record.personName}?`)) return;

    try {
      await db.localDB.remove(record);
      await loadRecords(selectedArea);

      // Refresh display
      if (selectedPersonId) {
        const newBalance = await calculatePersonBalance(selectedPersonId);
        const person = personsInArea.find((p) => p._id === selectedPersonId);
        if (person) {
          setDisplayPersons([{ ...person, balance: newBalance }]);
        }
      } else {
        await onAreaChange(selectedArea);
      }
      alert("Transaction deleted successfully.");
    } catch (e: any) {
      alert("Failed to delete: " + e.message);
    }
  };

  const transactionRows = records
    .filter((r: any) => {
      const personMatch = selectedPersonId
        ? r.personId === selectedPersonId
        : true;
      return personMatch;
    })
    .sort(
      (a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  const rowsToShow = selectedPersonId ? transactionRows : displayPersons;

  const getAreaName = (areaId: string) => {
    const area = areas.find((a) => a._id === areaId);
    return area ? area.name : "-";
  };

  const formatBalance = (balance: number) => {
    if (balance === 0) return "0.00";
    if (balance < 0) return `${Math.abs(balance).toFixed(2)}`;
    return `(${balance.toFixed(2)})`;
  };

  const printRecords = () => {
    const printWindow = window.open("", "", "width=1200,height=600");
    if (!printWindow) return;
    const tableHTML = `
			<!DOCTYPE html>
			<html>
			<head>
				<title>Family Cable Network - Records</title>
				<style>
					* { margin: 0; padding: 0; }
					body { font-family: Arial, sans-serif; padding: 20px; }
					h1 { text-align: center; margin-bottom: 20px; font-size: 24px; }
					table { width: 100%; border-collapse: collapse; margin-top: 20px; }
					thead { background-color: #f3f4f6; }
					th { padding: 12px; text-align: left; font-weight: bold; border-bottom: 2px solid #d1d5db; font-size: 12px; }
					td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; }
					.amount { text-align: right; }
				</style>
			</head>
			<body>
				<h1>Family Cable Network</h1>
				<table>
					<thead>
						<tr>
							<th>Receipt No</th>
							<th>Person</th>
							<th>Connection #</th>
							<th>Address</th>
							<th>Monthly Fee</th>
							<th class="amount">Amount Received</th>
							<th>Description</th>
							<th class="amount">Balance</th>
						</tr>
					</thead>
					<tbody>
						${records
              .map(
                (r) => `
							<tr>
								<td>${r.receiptNo || "-"}</td>
								<td>${r.personName || "-"}</td>
								<td>${r.connectionNumber || "-"}</td>
								<td>${r.personAddress || "-"}</td>
								<td class="amount">Rs.${Number(r.personMonthlyFee ?? 0).toFixed(2)}</td>
								<td class="amount">Rs.${Number(r.amount ?? 0).toFixed(2)}</td>
								<td>${r.description || "-"}</td>
								<td class="amount">Rs.${Number(r.remainingAfterPayment ?? 0).toFixed(2)}</td>
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
    printWindow.document.write(tableHTML);
    printWindow.document.close();
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    nextRef: React.RefObject<HTMLInputElement | null> | null,
  ) => {
    if ((e.key === "Tab" || e.key === "Enter") && !e.shiftKey && nextRef) {
      e.preventDefault();
      nextRef.current?.focus();
    }
  };

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
          Enter received amounts per customer
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        {/* Row 1: Area and Connection */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end mb-4">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Street Name
            </label>
            <select
              ref={areaRef as any}
              value={selectedArea}
              onChange={(e) => onAreaChange(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black bg-white"
            >
              <option value="">-- Select Street --</option>
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
                  if (!q) {
                    setConnectionSuggestions([]);
                    setSelectedPersonId("");
                    setSelectedPersonName("");
                    setSelectedPersonAddress("");
                    setSelectedPersonFee("");
                    setSelectedPersonReceiptNo("");
                    setReceiptNo("");
                    if (selectedArea) {
                      onAreaChange(selectedArea);
                    }
                    return;
                  }
                  const qLower = q.toLowerCase();
                  const filtered = personsInArea.filter((p) => {
                    const conn = String(p.connectionNumber ?? "").toLowerCase();
                    const name = String(p.name ?? "").toLowerCase();
                    return conn.includes(qLower) || name.includes(qLower);
                  });
                  setConnectionSuggestions(filtered.slice(0, 10));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && connectionSuggestions.length > 0) {
                    e.preventDefault();
                    onPersonSelect(connectionSuggestions[0]);
                    setTimeout(() => receiptRef.current?.focus(), 100);
                  }
                }}
                placeholder="Type connection # or name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
              />
              {connectionSuggestions.length > 0 && (
                <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded max-h-44 overflow-auto shadow-lg">
                  {connectionSuggestions.map((p) => (
                    <li
                      key={p._id}
                      onClick={() => {
                        onPersonSelect(p);
                        setConnectionSuggestions([]);
                        setTimeout(() => receiptRef.current?.focus(), 100);
                      }}
                      className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-black border-b border-gray-100"
                    >
                      <span className="font-medium">#{p.connectionNumber}</span>{" "}
                      - {p.name}
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

        {/* Row 2: Receipt No, Amount, Description */}
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
              placeholder="Enter description (optional)"
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
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">
            {selectedPersonId ? "Transaction History" : "All Connections"}
            {selectedPersonId && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                (for {selectedPersonName})
              </span>
            )}
          </h2>
          {rowsToShow.length > 0 && !selectedPersonId && (
            <button
              onClick={printRecords}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition"
            >
              Print List
            </button>
          )}
        </div>

        {rowsToShow.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-8">
            {selectedArea ? "No records found" : "Please select an area"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {!selectedPersonId && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Connection #
                    </th>
                  )}
                  {!selectedPersonId && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Customer Name
                    </th>
                  )}
                  {!selectedPersonId && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Area
                    </th>
                  )}
                  {!selectedPersonId && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Receipt No
                    </th>
                  )}
                  {!selectedPersonId && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Balance
                    </th>
                  )}

                  {selectedPersonId && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                  )}
                  {selectedPersonId && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Receipt No
                    </th>
                  )}
                  {selectedPersonId && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Description
                    </th>
                  )}
                  {selectedPersonId && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Amount
                    </th>
                  )}
                  {selectedPersonId && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Balance
                    </th>
                  )}
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rowsToShow.map((row: any) => (
                  <tr key={row._id} className="hover:bg-gray-50">
                    {!selectedPersonId && (
                      <>
                        <td className="px-6 py-3 text-sm text-gray-900">
                          {row.connectionNumber || "-"}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-900">
                          {row.name}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-500">
                          {getAreaName(row.areaId || selectedArea)}
                        </td>
                        <td className="px-6 py-3 text-sm font-medium text-blue-700">
                          {row.receiptNo || "-"}
                        </td>
                        <td
                          className={`px-6 py-3 text-sm text-right font-mono ${row.balance < 0 ? "text-red-600" : row.balance > 0 ? "text-green-600" : "text-gray-600"}`}
                        >
                          {row.balance < 0
                            ? `- Rs. ${Math.abs(row.balance).toFixed(2)}`
                            : row.balance > 0
                              ? `Rs. ${row.balance.toFixed(2)}`
                              : "0.00"}
                        </td>
                      </>
                    )}

                    {selectedPersonId && (
                      <>
                        <td className="px-6 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {row.date
                            ? new Date(row.date).toLocaleDateString()
                            : new Date(row.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-600 font-mono text-xs">
                          {row.receiptNo || "-"}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-700">
                          {row.description || "-"}
                        </td>
                        <td
                          className={`px-6 py-3 text-sm text-right font-mono ${row.type === "payment" ? "text-green-600" : "text-red-600"}`}
                        >
                          {row.type === "payment"
                            ? `+ Rs. ${Number(row.amount).toFixed(2)}`
                            : `- Rs. ${Number(row.amount).toFixed(2)}`}
                        </td>
                        <td className="px-6 py-3 text-sm text-right font-mono">
                          {formatBalance(row.balance || 0)}
                        </td>
                      </>
                    )}
                    <td className="px-6 py-3 text-sm text-center">
                      <button
                        onClick={() => deleteRecord(row)}
                        className="text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 rounded transition-colors duration-200"
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
