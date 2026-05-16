"use client";
import React, { useEffect, useState, useRef } from "react";
import { initDB } from "../services/db";

export default function CashReceivedPage() {
  const [db, setDb] = useState<any>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const [allPersons, setAllPersons] = useState<any[]>([]); // all persons across all areas
  const [selectedArea, setSelectedArea] = useState("");
  const [personsInArea, setPersonsInArea] = useState<any[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [selectedPersonName, setSelectedPersonName] = useState("");
  const [selectedPersonAddress, setSelectedPersonAddress] = useState("");
  const [selectedPersonFee, setSelectedPersonFee] = useState<number | "">("");
  const [selectedPersonReceiptNo, setSelectedPersonReceiptNo] = useState("");
  const [selectedPersonCreatedAt, setSelectedPersonCreatedAt] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedToMonth, setSelectedToMonth] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [lateFeeCharges, setLateFeeCharges] = useState<number | "">("");
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionQuery, setConnectionQuery] = useState("");
  const [connectionSuggestions, setConnectionSuggestions] = useState<any[]>([]);
  const [areaQuery, setAreaQuery] = useState("");
  const [areaSuggestions, setAreaSuggestions] = useState<any[]>([]);
  const [displayRows, setDisplayRows] = useState<any[]>([]);

  const monthRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const lateFeeRef = useRef<HTMLInputElement>(null);
  const connectionRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLInputElement>(null);

  // ─── Month helpers ────────────────────────────────────────────────────────
  const getMonthString = (date: Date) => date.toISOString().slice(0, 7);

  const getPreviousMonth = (month: string) => {
    const [year, mon] = month.split("-").map(Number);
    const d = new Date(year, mon - 2, 1);
    return getMonthString(d);
  };

  const calculateMonthsBetween = (start: string, end: string) => {
    const [sy, sm] = start.split("-").map(Number);
    const [ey, em] = end.split("-").map(Number);
    return (ey - sy) * 12 + (em - sm) + 1;
  };

  const getMonthsInRange = (fromMonth: string, toMonth: string) => {
    if (!fromMonth || !toMonth) return [];
    const [fy, fm] = fromMonth.split("-").map(Number);
    const [ty, tm] = toMonth.split("-").map(Number);
    const current = new Date(fy, fm - 1, 1);
    const end = new Date(ty, tm - 1, 1);
    const months: string[] = [];
    while (current <= end) {
      months.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`);
      current.setMonth(current.getMonth() + 1);
    }
    return months;
  };

  // ─── Display rows (summary view when no person selected) ─────────────────
  useEffect(() => {
    if (!selectedArea || personsInArea.length === 0) {
      setDisplayRows([]);
      return;
    }

    const rows = personsInArea.map((person) => {
      const monthlyFee = Number(person.amount || 0);
      const personRecords = records.filter((r: any) => r.personId === person._id);
      const startMonth = getMonthString(new Date(person.createdAt || new Date()));

      let endMonth: string;
      if (selectedMonth) {
        endMonth = selectedMonth;
      } else {
        const currentMonthStr = getMonthString(new Date());
        endMonth = getPreviousMonth(currentMonthStr);
      }

      const totalMonths = calculateMonthsBetween(startMonth, endMonth);
      const totalExpected = monthlyFee * totalMonths;

      const totalPaid = personRecords
        .filter((r: any) => {
          const rMonth = r.month || getMonthString(new Date(r.createdAt));
          return rMonth <= endMonth;
        })
        .reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);

      const pending = Math.max(0, totalExpected - totalPaid);

      let paidThisMonth = 0;
      if (selectedMonth) {
        paidThisMonth = personRecords
          .filter((r: any) => r.month === selectedMonth)
          .reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);
      }

      return {
        _id: person._id + "_computed_" + (selectedMonth || "all"),
        personId: person._id,
        personName: person.name,
        connectionNumber: person.connectionNumber || "-",
        receiptNo: person.receiptNo || "-",
        personAddress: person.address || "-",
        personMonthlyFee: monthlyFee,
        month: selectedMonth || "Up to now",
        amount: paidThisMonth,
        remainingAfterPayment: pending,
        isComputed: paidThisMonth === 0,
      };
    });

    setDisplayRows(rows);
  }, [selectedArea, selectedMonth, personsInArea, records]);

  // ─── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const setup = async () => {
      const pouch = await initDB();
      if (!pouch) return;
      setDb(pouch);
      try {
        const a = await pouch.getAreas();
        setAreas(a || []);
        // Load ALL persons once so connection search works across areas
        const all = await pouch.getAllPersons();
        setAllPersons(all || []);
      } catch (e) {
        console.warn("failed to load areas/persons", e);
      }
      setLoading(false);
    };
    setup();
  }, []);

  // ─── Area change ──────────────────────────────────────────────────────────
  const onAreaChange = async (areaId: string) => {
    setSelectedArea(areaId);
    setSelectedPersonId("");
    setSelectedPersonName("");
    setSelectedPersonAddress("");
    setSelectedPersonFee("");
    setSelectedPersonReceiptNo("");
    setSelectedToMonth("");
    setLateFeeCharges("");
    setRecords([]);
    setConnectionQuery("");
    setConnectionSuggestions([]);
    if (!db || !areaId) return;
    try {
      const p = await db.getPersonsByArea(areaId);
      setPersonsInArea(p || []);
      await loadRecords(areaId);
    } catch (e) {
      console.warn("failed to load persons/records", e);
    }
  };

  // ─── Person select ────────────────────────────────────────────────────────
  const onPersonSelect = async (personId: string, areaIdOverride?: string) => {
    // If person is from a different area, switch area first
    const targetAreaId = areaIdOverride || selectedArea;

    // Find person in personsInArea or allPersons
    let person = personsInArea.find((x) => x._id === personId);
    if (!person) {
      person = allPersons.find((x) => x._id === personId);
    }

    if (!person) return;

    // If area needs to switch
    if (person.areaId && person.areaId !== selectedArea) {
      const areaName = areas.find((a) => a._id === person.areaId)?.name || "";
      setAreaQuery(areaName);
      setAreaSuggestions([]);
      await onAreaChange(person.areaId);
      // After area loads, re-select person
      setSelectedPersonId(person._id);
      setSelectedPersonName(person.name || "");
      setSelectedPersonAddress(person.address || "");
      setSelectedPersonFee(person.amount || "");
      setSelectedPersonReceiptNo(person.receiptNo || "");
      setSelectedPersonCreatedAt(person.createdAt ?? null);
      setConnectionQuery(String(person.connectionNumber ?? ""));
      setConnectionSuggestions([]);
      if (person.amount && !amount) setAmount(person.amount);
      return;
    }

    setSelectedPersonId(person._id);
    setSelectedPersonName(person.name || "");
    setSelectedPersonAddress(person.address || "");
    setSelectedPersonFee(person.amount || "");
    setSelectedPersonReceiptNo(person.receiptNo || "");
    setSelectedPersonCreatedAt(person.createdAt ?? null);
    setConnectionQuery(String(person.connectionNumber ?? ""));
    setConnectionSuggestions([]);
    if (person.amount && !amount) setAmount(person.amount);
  };

  // ─── Connection search — searches across ALL persons, shows area name ─────
  const onConnectionQueryChange = (q: string) => {
    setConnectionQuery(q);
    setSelectedPersonId(""); // clear selection when typing

    if (!q.trim()) {
      setConnectionSuggestions([]);
      return;
    }

    const qLower = q.toLowerCase();

    // Search across ALL persons (not just current area)
    const pool = selectedArea
      ? personsInArea  // if area already chosen, search within it
      : allPersons;    // otherwise search globally

    const filtered = pool
      .filter((p) => {
        const conn = String(p.connectionNumber ?? "").toLowerCase();
        const name = String(p.name ?? "").toLowerCase();
        return conn.includes(qLower) || name.includes(qLower);
      })
      .slice(0, 20);

    setConnectionSuggestions(filtered);
  };

  // ─── Load records ─────────────────────────────────────────────────────────
  const loadRecords = async (areaId: string) => {
    if (!db) return;
    try {
      await db.localDB.createIndex({ index: { fields: ["type", "areaId"] } });
      const res = await db.localDB.find({ selector: { type: "debit", areaId } });
      setRecords(res.docs || []);
    } catch (e) {
      console.warn("failed to load records", e);
    }
  };

  // ─── Add record ───────────────────────────────────────────────────────────
  const addRecord = async () => {
    if (!db || !selectedPersonId) {
      alert("Please select a connection number (person)");
      return;
    }
    if (!selectedMonth) {
      alert("Please select a month");
      return;
    }
    if (amount === "" || Number(amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    try {
      let person = personsInArea.find((p) => p._id === selectedPersonId);
      if (!person) person = allPersons.find((p) => p._id === selectedPersonId);
      if (!person) return;

      const monthlyFee = Number(person.amount || selectedPersonFee || 0);
      const currentRemaining = Number(person.remainingBalance || 0);

      const fromMonth = selectedMonth;
      const toMonthValue = selectedToMonth || selectedMonth;

      if (toMonthValue < fromMonth) {
        alert("To Month cannot be earlier than From Month");
        return;
      }

      const months = getMonthsInRange(fromMonth, toMonthValue);
      if (months.length === 0) {
        alert("Invalid month range");
        return;
      }

      const lateFee = Number(lateFeeCharges) || 0;
      const now = new Date().toISOString();
      let remainingToAllocate = Number(amount) + lateFee;
      let runningBalance = currentRemaining;
      const docs: any[] = [];

      for (let i = 0; i < months.length; i++) {
        const month = months[i];
        runningBalance += monthlyFee;
        const expectedThisMonth = runningBalance;
        let payForThisMonth = 0;

        if (remainingToAllocate > 0) {
          if (i < months.length - 1) {
            payForThisMonth = Math.min(remainingToAllocate, expectedThisMonth);
          } else {
            payForThisMonth = remainingToAllocate;
          }
        }

        const remainingAfterPayment = Math.max(0, expectedThisMonth - payForThisMonth);

        if (payForThisMonth > 0) {
          docs.push({
            _id: `debit_${selectedArea}_${selectedPersonId}_${month}_${Date.now()}_${i}`,
            type: "debit",
            areaId: selectedArea || person.areaId,
            personId: selectedPersonId,
            personName: selectedPersonName,
            personAddress: selectedPersonAddress,
            personMonthlyFee: monthlyFee,
            connectionNumber: connectionQuery,
            receiptNo: selectedPersonReceiptNo,
            month,
            amount: Number(payForThisMonth),
            lateFeeCharges: i === months.length - 1 ? lateFee : 0,
            expectedAmount: expectedThisMonth,
            remainingAfterPayment,
            paymentFromMonth: fromMonth,
            paymentToMonth: toMonthValue,
            createdAt: now,
          });
        }

        runningBalance = remainingAfterPayment;
        remainingToAllocate = Math.max(0, remainingToAllocate - payForThisMonth);
      }

      const updatedPerson = {
        ...person,
        remainingBalance: Math.max(0, runningBalance),
        lastPaymentDate: now,
        updatedAt: now,
      };

      await db.localDB.put(updatedPerson);
      for (const doc of docs) {
        await db.localDB.put(doc);
      }

      const areaToReload = selectedArea || person.areaId;
      await loadRecords(areaToReload);
      await onAreaChange(areaToReload);

      setAmount("");
      setLateFeeCharges("");
      setSelectedMonth("");
      setSelectedToMonth("");

      alert("Payment recorded successfully!");
    } catch (e: any) {
      console.error(e);
      alert("Failed to save payment: " + e.message);
    }
  };

  // ─── Delete record ────────────────────────────────────────────────────────
  const deleteRecord = async (r: any) => {
    if (!db) return;
    if (!confirm(`Delete transaction for ${r.personName} (Conn #${r.connectionNumber || "unknown"}) on ${r.month}?`)) return;

    try {
      if (r._id && !r._id.includes("_computed_")) {
        const recordToDelete = r._rev ? r : await db.localDB.get(r._id);
        await db.localDB.remove(recordToDelete);
      } else if (r.isComputed || r._id.includes("_computed_")) {
        const actualRecords = records.filter(
          (rec: any) => rec.personId === r.personId && rec.month === r.month
        );
        for (const rec of actualRecords) {
          const recordToDelete = rec._rev ? rec : await db.localDB.get(rec._id);
          await db.localDB.remove(recordToDelete);
        }
      }

      await loadRecords(selectedArea);
      await onAreaChange(selectedArea);
      alert("Transaction deleted successfully.");
    } catch (e: any) {
      console.error("failed to delete record", e);
      alert("Failed to delete: " + (e?.message || "Unknown error"));
    }
  };

  // ─── Summary stats ────────────────────────────────────────────────────────
  const toMonth = (dStr?: string | null) => {
    if (!dStr) return null;
    try {
      const d = new Date(dStr);
      if (Number.isNaN(d.getTime())) return null;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    } catch {
      return null;
    }
  };

  const selectedPersonRecords = selectedPersonId
    ? records.filter((r: any) => r.personId === selectedPersonId)
    : [];

  const paidInSelectedMonth = selectedMonth
    ? selectedPersonRecords
        .filter((r: any) => (r.month || toMonth(r.createdAt)) === selectedMonth)
        .reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0)
    : 0;

  const expectedPerMonth = Number(selectedPersonFee) || 0;
  const selectedPendingAmount = selectedMonth ? Math.max(0, expectedPerMonth - paidInSelectedMonth) : 0;

  const earliestRecordDate = selectedPersonRecords.reduce((min: string | null, r: any) => {
    if (!r.createdAt) return min;
    const d = new Date(r.createdAt);
    if (!min) return d.toISOString();
    return new Date(min) > d ? d.toISOString() : min;
  }, null as string | null);

  const startDate = selectedPersonCreatedAt
    ? new Date(selectedPersonCreatedAt)
    : earliestRecordDate
    ? new Date(earliestRecordDate)
    : null;

  const monthsBetween = (start?: Date | null, end: Date = new Date()) => {
    if (!start) return 1;
    return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
  };

  const monthsCount = monthsBetween(startDate);
  const totalExpectedAllTime = expectedPerMonth * monthsCount;
  const totalPaidAllTime = selectedPersonRecords.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
  const allTimeBalance = totalExpectedAllTime - totalPaidAllTime;

  const transactionRows = records
    .filter((r: any) => {
      const monthMatch = selectedMonth ? r.month === selectedMonth : true;
      const personMatch = selectedPersonId ? r.personId === selectedPersonId : true;
      return monthMatch && personMatch;
    })
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const rowsToShow = selectedPersonId ? transactionRows : displayRows;

  // ─── Print ────────────────────────────────────────────────────────────────
  const printRecords = () => {
    const printWindow = window.open("", "", "width=1200,height=600");
    if (!printWindow) return;

    printWindow.document.write(`
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
          .pending { color: #dc2626; font-weight: bold; text-align: right; }
        </style>
      </head>
      <body>
        <h1>Family Cable Network</h1>
        <table>
          <thead>
            <tr>
              <th>Receipt No</th><th>Person</th><th>Connection #</th>
              <th>Address</th><th>Monthly Fee</th><th>Month</th>
              <th class="amount">Amount Received</th>
              <th class="amount">Late Fee</th>
              <th class="amount">Pending / Balance Due</th>
            </tr>
          </thead>
          <tbody>
            ${records.map((r) => `
              <tr>
                <td>${r.receiptNo || "-"}</td>
                <td>${r.personName || "-"}</td>
                <td>${r.connectionNumber || "-"}</td>
                <td>${r.personAddress || "-"}</td>
                <td class="amount">Rs.${Number(r.personMonthlyFee ?? 0).toFixed(2)}</td>
                <td>${r.month || "-"}</td>
                <td class="amount">Rs.${Number(r.amount ?? 0).toFixed(2)}</td>
                <td class="amount" style="color:${Number(r.lateFeeCharges) > 0 ? "#c05300" : "#6b7280"}">
                  ${Number(r.lateFeeCharges) > 0 ? "Rs." + Number(r.lateFeeCharges).toFixed(2) : "-"}
                </td>
                <td class="pending">Rs.${Number(r.remainingAfterPayment ?? 0).toFixed(2)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <script>window.print();</script>
      </body>
      </html>
    `);
    printWindow.document.close();
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
        <h1 className="text-2xl font-bold text-black">Cash Received From Customer</h1>
        <p className="text-sm text-gray-600">Enter received amounts per person and month</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">

          {/* Area */}
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Area</label>
            <div className="relative">
              <input
                ref={areaRef}
                type="text"
                value={areaQuery}
                onChange={(e) => {
                  const q = String(e.target.value || "");
                  setAreaQuery(q);
                  if (!q) { setAreaSuggestions([]); return; }
                  const filtered = areas.filter((ar) =>
                    String(ar.name || "").toLowerCase().startsWith(q.toLowerCase())
                  );
                  setAreaSuggestions(filtered.slice(0, 20));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && areaSuggestions.length > 0) {
                    e.preventDefault();
                    setAreaQuery(areaSuggestions[0].name || "");
                    setAreaSuggestions([]);
                    onAreaChange(areaSuggestions[0]._id);
                    setTimeout(() => connectionRef.current?.focus(), 100);
                  } else if (e.key === "Enter" && selectedArea) {
                    e.preventDefault();
                    connectionRef.current?.focus();
                  }
                }}
                placeholder="Type area name..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
              />
              {areaSuggestions.length > 0 && (
                <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded max-h-44 overflow-auto shadow-lg">
                  {areaSuggestions.map((a) => (
                    <li
                      key={a._id}
                      onClick={() => {
                        setAreaQuery(a.name || "");
                        setAreaSuggestions([]);
                        onAreaChange(a._id);
                        setTimeout(() => connectionRef.current?.focus(), 100);
                      }}
                      className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-black"
                    >
                      {a.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Connection Number — shows area name in suggestions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Connection No</label>
            <div className="relative">
              <input
                ref={connectionRef}
                type="text"
                value={connectionQuery}
                onChange={(e) => onConnectionQueryChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (connectionSuggestions.length > 0) {
                      onPersonSelect(connectionSuggestions[0]._id);
                      setTimeout(() => monthRef.current?.focus(), 100);
                    } else if (selectedPersonId) {
                      monthRef.current?.focus();
                    }
                  }
                }}
                placeholder={selectedArea ? "Type conn # or name..." : "Select area first, or type to search all"}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
              />

              {connectionSuggestions.length > 0 && (
                <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded max-h-56 overflow-auto shadow-lg">
                  {connectionSuggestions.map((p) => {
                    const areaName = areas.find((a) => a._id === p.areaId)?.name || "";
                    const isCurrentArea = p.areaId === selectedArea;
                    return (
                      <li
                        key={p._id}
                        onClick={() => {
                          onPersonSelect(p._id);
                          setTimeout(() => monthRef.current?.focus(), 100);
                        }}
                        className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer text-sm text-black border-b border-gray-100 last:border-0"
                      >
                        {/* Conn number + name */}
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            Conn #{p.connectionNumber ?? "-"} — {p.name}
                          </span>
                          {/* Area badge */}
                          <span className={`ml-3 text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                            isCurrentArea
                              ? "bg-blue-100 text-blue-700"
                              : "bg-orange-100 text-orange-700"
                          }`}>
                            {areaName || "Unknown area"}
                          </span>
                        </div>
                        {/* Sub-line: address */}
                        {p.address && p.address !== "-" && (
                          <div className="text-xs text-gray-400 mt-0.5 truncate">{p.address}</div>
                        )}
                        {/* Warning if different area */}
                        {!isCurrentArea && selectedArea && (
                          <div className="text-xs text-orange-500 mt-0.5">
                            ⚠ Different area — will switch to {areaName}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Person Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Person Name</label>
            <input
              type="text"
              value={selectedPersonName}
              onChange={(e) => setSelectedPersonName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-black"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
            <input
              type="text"
              value={selectedPersonAddress}
              onChange={(e) => setSelectedPersonAddress(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-black"
            />
          </div>

          {/* Monthly Fee */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Fee</label>
            <input
              type="text"
              value={selectedPersonFee === "" ? "" : Number(selectedPersonFee).toFixed(2)}
              readOnly
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-black"
            />
          </div>
        </div>

        {/* Row 2: months, amount, late fee, actions */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mt-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Month</label>
            <input
              ref={monthRef}
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); amountRef.current?.focus(); }
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Month (Optional)</label>
            <input
              type="month"
              value={selectedToMonth}
              onChange={(e) => setSelectedToMonth(e.target.value)}
              min={selectedMonth || undefined}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Amount Received</label>
            <input
              ref={amountRef}
              type="number"
              value={amount === "" ? "" : amount}
              onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); lateFeeRef.current?.focus(); }
              }}
              placeholder="0.00"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Late Fee Charges</label>
            <input
              ref={lateFeeRef}
              type="number"
              value={lateFeeCharges === "" ? "" : lateFeeCharges}
              onChange={(e) => setLateFeeCharges(e.target.value === "" ? "" : Number(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addRecord(); }
              }}
              placeholder="0.00"
              className="w-full px-4 py-3 border border-orange-300 rounded-lg text-black focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
            {(Number(amount) > 0 || Number(lateFeeCharges) > 0) && (
              <div className="mt-1 text-xs text-gray-600">
                Total: Rs.{(Number(amount) + Number(lateFeeCharges || 0)).toFixed(2)}
                {Number(lateFeeCharges) > 0 && (
                  <span className="ml-2 text-orange-600 font-medium">
                    (incl. Rs.{Number(lateFeeCharges).toFixed(2)} late fee)
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={addRecord}
              className="px-4 py-3 flex-1 bg-gradient-to-r from-blue-600 to-purple-700 text-white text-sm rounded-lg hover:from-blue-700 hover:to-purple-800 transition-colors duration-200"
            >
              Add Record
            </button>
            <button
              onClick={printRecords}
              className="px-4 py-3 flex-1 bg-gradient-to-r from-green-600 to-teal-700 text-white text-sm rounded-lg hover:from-green-700 hover:to-teal-800 transition-colors duration-200"
            >
              Print
            </button>
          </div>
        </div>

        {/* Summary cards */}
        {selectedPersonId && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {selectedMonth && (
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                <div className="text-xs text-gray-600">Pending for {selectedMonth}</div>
                <div className="text-lg font-semibold text-red-600">
                  Rs.{Number(selectedPendingAmount).toFixed(2)}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Expected: Rs.{Number(expectedPerMonth).toFixed(2)} — Paid: Rs.{Number(paidInSelectedMonth).toFixed(2)}
                </div>
              </div>
            )}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="text-xs text-gray-600">All-time balance</div>
              <div className="text-lg font-semibold text-black">
                Rs.{Number(allTimeBalance).toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Records table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">
            Records
            {selectedMonth && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                (for {new Date(selectedMonth + "-01").toLocaleString("default", { month: "long", year: "numeric" })})
              </span>
            )}
          </h2>
          {rowsToShow.length > 0 && (
            <button
              onClick={printRecords}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition"
            >
              Print Monthly list
            </button>
          )}
        </div>

        {rowsToShow.length === 0 ? (
          <div className="text-sm text-gray-500">No matching records found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {["Receipt No", "Person", "Connection #", "Address", "Monthly Fee", "Month", "Amount Received", "Late Fee", "Pending / Balance Due", "Actions"].map((h) => (
                    <th key={h} className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${h === "Late Fee" ? "text-orange-500" : "text-gray-500"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rowsToShow.map((row: any) => (
                  <tr key={row._id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm font-medium text-blue-700">{row.receiptNo || "-"}</td>
                    <td className="px-6 py-3 text-sm text-gray-900">{row.personName}</td>
                    <td className="px-6 py-3 text-sm text-gray-900">{row.connectionNumber || "-"}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{row.personAddress || "-"}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">Rs.{Number(row.personMonthlyFee).toFixed(2)}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{row.month || "-"}</td>
                    <td className="px-6 py-3 text-sm text-gray-900 font-medium">Rs.{Number(row.amount).toFixed(2)}</td>
                    <td className="px-6 py-3 text-sm font-medium">
                      {Number(row.lateFeeCharges) > 0
                        ? <span className="text-orange-600">Rs.{Number(row.lateFeeCharges).toFixed(2)}</span>
                        : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-6 py-3 text-sm text-red-600 font-semibold">Rs.{Number(row.remainingAfterPayment).toFixed(2)}</td>
                    <td className="px-6 py-3 text-sm">
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