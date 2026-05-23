"use client";

import { useEffect, useRef, useState } from "react";
import { initDB } from "../services/db";

export default function PersonRecordsPage() {
  const [db, setDb] = useState<any>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const [selectedArea, setSelectedArea] = useState("");

  const [personsInArea, setPersonsInArea] = useState<any[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [connectionQuery, setConnectionQuery] = useState("");
  const [connectionSuggestions, setConnectionSuggestions] = useState<any[]>([]);

  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");

  const [allRecords, setAllRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const connectionRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const setup = async () => {
      const pouch = await initDB();
      if (!pouch) return;

      if (typeof pouch.syncDB === "function") {
        pouch.syncDB();
      }

      setDb(pouch);
      const a = await pouch.getAreas();
      setAreas(a || []);
      setLoading(false);
    };

    setup();
  }, []);

  const safeNumber = (value: any) => Number(value || 0);

  const getMonthKey = (dateInput?: any) => {
    const date = dateInput ? new Date(dateInput) : new Date();

    if (Number.isNaN(date.getTime())) {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  };

  const normalizeMonthInput = (value: string) => {
    let v = value.replace(/[^\d-]/g, "");

    if (/^\d{6}$/.test(v)) {
      v = `${v.slice(0, 4)}-${v.slice(4, 6)}`;
    }

    return v;
  };

  const getMonthLabel = (month: string) => {
    if (!/^\d{4}-\d{2}$/.test(month || "")) return month || "-";

    const [year, mon] = month.split("-").map(Number);
    return new Date(year, mon - 1, 1).toLocaleString("default", {
      month: "long",
      year: "numeric",
    });
  };

  const formatAmount = (value: any) => `Rs.${safeNumber(value).toFixed(2)}`;

  const formatBalance = (value: any) => {
    const balance = safeNumber(value);

    if (balance > 0) return `Pending Rs.${balance.toFixed(2)}`;
    if (balance < 0) return `Advance Rs.${Math.abs(balance).toFixed(2)}`;

    return "Rs.0.00";
  };

  const getBalanceClass = (value: any) => {
    const balance = safeNumber(value);

    if (balance > 0) return "text-red-600";
    if (balance < 0) return "text-green-600";

    return "text-gray-700";
  };

  const getMonthsBetween = (startMonth: string, endMonth: string) => {
    const months: string[] = [];

    if (!/^\d{4}-\d{2}$/.test(startMonth) || !/^\d{4}-\d{2}$/.test(endMonth)) {
      return months;
    }

    const [startYear, startMon] = startMonth.split("-").map(Number);
    const [endYear, endMon] = endMonth.split("-").map(Number);

    const cursor = new Date(startYear, startMon - 1, 1);
    const end = new Date(endYear, endMon - 1, 1);

    while (cursor <= end) {
      months.push(getMonthKey(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return months;
  };

  const buildPersonRows = (person: any, docs: any[]) => {
    const personId = person._id;
    const monthlyFee = safeNumber(person.amount || person.monthlyFee || 0);
    const startMonth = getMonthKey(person.createdAt || new Date());
    const currentMonth = getMonthKey(new Date());

    const personDocs = docs.filter((doc: any) => doc.personId === personId);

    const existingMonthlyFeeMonths = new Set(
      personDocs
        .filter((doc: any) => doc.type === "customer-debit" && doc.isMonthlyFee && doc.month)
        .map((doc: any) => String(doc.month)),
    );

    const autoMonthlyFeeDocs = getMonthsBetween(startMonth, currentMonth)
      .filter((month) => !existingMonthlyFeeMonths.has(month))
      .map((month) => ({
        _id: `auto_monthly_fee_${personId}_${month}`,
        type: "customer-debit",
        personId,
        areaId: person.areaId,
        connectionNumber: person.connectionNumber || "-",
        personName: person.name,
        personAddress: person.address || "-",
        receiptNo: person.receiptNo || "-",
        personMonthlyFee: monthlyFee,
        month,
        amount: monthlyFee,
        monthlyFeeDeducted: monthlyFee,
        date: `${month}-01`,
        createdAt: `${month}-01T00:00:00.000Z`,
        description: `${getMonthLabel(month)} Monthly Fee`,
        isAutoMonthlyFee: true,
        isMonthlyFee: true,
      }));

    const ledgerDocs = [...autoMonthlyFeeDocs, ...personDocs].sort((a: any, b: any) => {
      const aTime = new Date(a.createdAt || a.date || `${a.month || "1970-01"}-01`).getTime();
      const bTime = new Date(b.createdAt || b.date || `${b.month || "1970-01"}-01`).getTime();

      if (aTime !== bTime) return aTime - bTime;

      const order: Record<string, number> = {
        "customer-debit": 1,
        debit: 1,
        payment: 2,
        "credit-note": 3,
      };

      return (order[a.type] || 99) - (order[b.type] || 99);
    });

    let runningBalance = 0;

    return ledgerDocs.map((doc: any) => {
      const month = doc.month || getMonthKey(doc.date || doc.createdAt);
      const isDebit = doc.type === "customer-debit" || doc.type === "debit";
      const isPayment = doc.type === "payment";
      const isCreditNote = doc.type === "credit-note";

      const monthlyFeeDeducted = isDebit ? safeNumber(doc.amount) : 0;
      const amountReceived = isPayment || isCreditNote ? safeNumber(doc.amount) : 0;
      const lateFeeCharges = safeNumber(doc.lateFeeCharges || 0);

      runningBalance = runningBalance + monthlyFeeDeducted - amountReceived;

      return {
        ...doc,
        _id: doc._id,
        areaId: person.areaId,
        personId,
        personName: doc.personName || person.name,
        personAddress: doc.personAddress || person.address || "-",
        connectionNumber: doc.connectionNumber || person.connectionNumber || "-",
        receiptNo: doc.receiptNo || person.receiptNo || "-",
        month,
        amount: amountReceived,
        amountReceived,
        monthlyFeeDeducted,
        lateFeeCharges,
        totalCollected: amountReceived + lateFeeCharges,
        remainingAfterPayment: runningBalance,
        balance: runningBalance,
        isCreditNote,
      };
    });
  };

  const loadAreaRecords = async (areaId: string, personsList?: any[]) => {
    if (!db || !areaId) return;

    const persons = personsList || personsInArea;
    const result = await db.localDB.allDocs({ include_docs: true });

    const docs = result.rows
      .map((row: any) => row.doc)
      .filter(
        (doc: any) =>
          doc &&
          !doc._deleted &&
          doc.areaId === areaId &&
          ["debit", "payment", "credit-note", "customer-debit"].includes(doc.type),
      );

    const rows = persons.flatMap((person: any) => buildPersonRows(person, docs));

    rows.sort((a: any, b: any) => {
      const aTime = new Date(a.createdAt || a.date || `${a.month || "1970-01"}-01`).getTime();
      const bTime = new Date(b.createdAt || b.date || `${b.month || "1970-01"}-01`).getTime();
      if (aTime !== bTime) return aTime - bTime;
      return String(a.connectionNumber || "").localeCompare(String(b.connectionNumber || ""));
    });

    setAllRecords(rows);
  };

  const loadPersonRecords = async (personId: string, areaId: string, personArg?: any) => {
    if (!db) return;

    const person = personArg || selectedPerson;
    if (!person) return;

    const result = await db.localDB.allDocs({ include_docs: true });

    const docs = result.rows
      .map((row: any) => row.doc)
      .filter(
        (doc: any) =>
          doc &&
          !doc._deleted &&
          doc.personId === personId &&
          ["debit", "payment", "credit-note", "customer-debit"].includes(doc.type),
      );

    const rows = buildPersonRows(person, docs);
    setAllRecords(rows);
  };

  const onAreaChange = async (areaId: string) => {
    setSelectedArea(areaId);
    setSelectedPerson(null);
    setConnectionQuery("");
    setConnectionSuggestions([]);
    setAllRecords([]);
    setFromMonth("");
    setToMonth("");

    if (!db || !areaId) {
      setPersonsInArea([]);
      return;
    }

    const persons = await db.getPersonsByArea(areaId);
    setPersonsInArea(persons || []);

    const currentMonth = getMonthKey(new Date());
    setFromMonth(currentMonth);
    setToMonth(currentMonth);

    await loadAreaRecords(areaId, persons || []);

    setTimeout(() => connectionRef.current?.focus(), 100);
  };

  const onPersonSelect = async (person: any) => {
    setSelectedPerson(person);
    setConnectionQuery(`${person.connectionNumber} — ${person.name}`);
    setConnectionSuggestions([]);

    const personStartMonth = getMonthKey(person.createdAt || new Date());
    const currentMonth = getMonthKey(new Date());

    setFromMonth(personStartMonth);
    setToMonth(currentMonth);

    if (!db) return;
    await loadPersonRecords(person._id, person.areaId, person);
  };

  const showEntireArea = async () => {
    setSelectedPerson(null);
    setConnectionQuery("");
    setConnectionSuggestions([]);

    const currentMonth = getMonthKey(new Date());
    setFromMonth(currentMonth);
    setToMonth(currentMonth);

    if (selectedArea) {
      await loadAreaRecords(selectedArea);
    }
  };

  const filteredRecords = allRecords.filter((r) => {
    const m = r.month || "";
    if (fromMonth && m < fromMonth) return false;
    if (toMonth && m > toMonth) return false;
    return true;
  });

  const totalAmountReceived = filteredRecords.reduce(
    (s, r) => s + safeNumber(r.amountReceived ?? r.amount),
    0,
  );

  const totalMonthlyFeeDeducted = filteredRecords.reduce(
    (s, r) => s + safeNumber(r.monthlyFeeDeducted),
    0,
  );

  const totalLateFee = filteredRecords.reduce(
    (s, r) => s + safeNumber(r.lateFeeCharges),
    0,
  );

  const currentBalance = selectedPerson
    ? safeNumber(filteredRecords[filteredRecords.length - 1]?.remainingAfterPayment || 0)
    : Object.values(
        filteredRecords.reduce((map: Record<string, number>, record: any) => {
          map[record.personId] = safeNumber(record.remainingAfterPayment);
          return map;
        }, {}),
      ).reduce((sum: number, balance: any) => sum + safeNumber(balance), 0);

  const totalCustomers = selectedPerson ? 1 : personsInArea.length;

  const clearFilters = async () => {
    if (selectedPerson) {
      setFromMonth(getMonthKey(selectedPerson.createdAt || new Date()));
      setToMonth(getMonthKey(new Date()));
      return;
    }

    const currentMonth = getMonthKey(new Date());
    setFromMonth(currentMonth);
    setToMonth(currentMonth);
  };

  const printRecords = () => {
    if (filteredRecords.length === 0) return;

    const win = window.open("", "_blank", "width=1100,height=700");
    if (!win) return;

    const areaName = areas.find((a) => a._id === selectedArea)?.name || "";
    const title = selectedPerson ? "Person Records" : "Area Records";

    win.document.write(`
      <!DOCTYPE html><html><head><title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; }
        .header { text-align:center; margin-bottom:20px; direction:rtl; }
        .header h2 { font-size:22px; color:#333; margin:0; }
        .meta { margin-bottom:16px; font-size:13px; color:#555; }
        table { width:100%; border-collapse:collapse; margin-top:16px; font-size:12px; }
        th { background:#f4f4f4; padding:9px 10px; text-align:left; border-bottom:2px solid #ddd; font-weight:bold; }
        td { padding:8px 10px; border-bottom:1px solid #eee; }
        .green { color:#15803d; font-weight:bold; }
        .orange { color:#c05300; font-weight:bold; }
        .red { color:#dc2626; font-weight:bold; }
        .summary { margin-top:18px; padding:12px; background:#f9f9f9; border:1px solid #e5e5e5; border-radius:6px; font-size:13px; }
        .summary span { margin-right:24px; display:inline-block; margin-bottom:6px; }
      </style></head><body>
      <div class="header"><h2>فیملی کیبل نیٹ ورک</h2></div>
      <div class="meta">
        <strong>Report:</strong> ${title} &nbsp;|&nbsp;
        ${selectedPerson ? `<strong>Person:</strong> ${selectedPerson.name} &nbsp;|&nbsp; <strong>Conn #:</strong> ${selectedPerson.connectionNumber} &nbsp;|&nbsp; <strong>Receipt No:</strong> ${selectedPerson.receiptNo || "-"} &nbsp;|&nbsp;` : ""}
        <strong>Area:</strong> ${areaName} &nbsp;|&nbsp;
        <strong>Period:</strong> ${fromMonth || "Start"} → ${toMonth || "Latest"}
      </div>
      <table>
        <thead><tr>
          <th>Month</th>
          ${!selectedPerson ? "<th>Conn #</th><th>Customer</th><th>Receipt No</th>" : ""}
          <th>Monthly Fee Deducted</th>
          <th>Amount Received</th>
          <th>Late Fee</th>
          <th>Total Collected</th>
          <th>Pending / Balance</th>
        </tr></thead>
        <tbody>
          ${filteredRecords
            .map(
              (r) => `
            <tr>
              <td>${r.month || "-"}</td>
              ${!selectedPerson ? `<td>${r.connectionNumber || "-"}</td><td>${r.personName || "-"}</td><td>${r.receiptNo || "-"}</td>` : ""}
              <td class="red">${r.monthlyFeeDeducted ? "Rs." + Number(r.monthlyFeeDeducted || 0).toFixed(2) : "-"}</td>
              <td class="green">${r.amountReceived ? "Rs." + Number(r.amountReceived || 0).toFixed(2) : "-"}</td>
              <td class="orange">${Number(r.lateFeeCharges) > 0 ? "Rs." + Number(r.lateFeeCharges).toFixed(2) : "-"}</td>
              <td>Rs.${Number(r.totalCollected || 0).toFixed(2)}</td>
              <td class="${Number(r.remainingAfterPayment || 0) > 0 ? "red" : "green"}">${formatBalance(r.remainingAfterPayment)}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
      <div class="summary">
        <span><strong>Total Paid:</strong> Rs.${totalAmountReceived.toFixed(2)}</span>
        <span><strong>Total Monthly Fee Deducted:</strong> Rs.${totalMonthlyFeeDeducted.toFixed(2)}</span>
        <span><strong>Total Late Fee:</strong> Rs.${totalLateFee.toFixed(2)}</span>
        <span><strong>Current Balance:</strong> ${formatBalance(currentBalance)}</span>
      </div>
      <script>window.onload=function(){window.print();setTimeout(()=>window.close(),1000);}</script>
      </body></html>
    `);

    win.document.close();
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-1">
          Person Transaction History
        </h1>
        <p className="text-gray-500">
          View all payment records for any person, filtered by month range
        </p>
      </div>

      {/* Selection Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Select Person
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Area */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Area
            </label>
            <select
              value={selectedArea}
              onChange={(e) => onAreaChange(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 bg-white"
            >
              <option value="">-- Select Area --</option>
              {areas.map((area) => (
                <option key={area._id} value={area._id}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>

          {/* Person */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Connection # / Name
            </label>
            <div className="relative">
              <input
                ref={connectionRef}
                type="text"
                value={connectionQuery}
                onChange={(e) => {
                  const q = e.target.value;
                  setConnectionQuery(q);
                  if (!q) {
                    setConnectionSuggestions([]);
                    return;
                  }
                  const ql = q.toLowerCase();
                  setConnectionSuggestions(
                    personsInArea
                      .filter(
                        (p) =>
                          String(p.connectionNumber ?? "")
                            .toLowerCase()
                            .includes(ql) ||
                          String(p.name ?? "")
                            .toLowerCase()
                            .includes(ql),
                      )
                      .slice(0, 20),
                  );
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && connectionSuggestions.length > 0) {
                    onPersonSelect(connectionSuggestions[0]);
                  }
                }}
                placeholder="Type connection # or name..."
                disabled={!selectedArea}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400 disabled:bg-gray-50 disabled:text-gray-400"
              />
              {connectionSuggestions.length > 0 && (
                <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg max-h-44 overflow-auto shadow-lg">
                  {connectionSuggestions.map((p) => (
                    <li
                      key={p._id}
                      onClick={() => onPersonSelect(p)}
                      className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-800"
                    >
                      <span className="font-medium text-blue-700">
                        {p.connectionNumber}
                      </span>
                      <span className="mx-2 text-gray-400">—</span>
                      {p.name}
                      {p.receiptNo && (
                        <span className="ml-2 text-xs text-gray-400">
                          Receipt: {p.receiptNo}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Person info strip */}
        {selectedPerson ? (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100 flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-gray-500">Name:</span>{" "}
              <span className="font-semibold text-gray-800 ml-1">
                {selectedPerson.name}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Conn #:</span>{" "}
              <span className="font-semibold text-gray-800 ml-1">
                {selectedPerson.connectionNumber}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Receipt No:</span>{" "}
              <span className="font-semibold text-blue-700 ml-1">
                {selectedPerson.receiptNo || "-"}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Address:</span>{" "}
              <span className="font-semibold text-gray-800 ml-1">
                {selectedPerson.address || "-"}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Monthly Fee:</span>{" "}
              <span className="font-semibold text-gray-800 ml-1">
                Rs.{Number(selectedPerson.amount || 0).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Current Balance:</span>{" "}
              <span className={`font-semibold ml-1 ${getBalanceClass(currentBalance)}`}>
                {formatBalance(currentBalance)}
              </span>
            </div>
            <button
              onClick={showEntireArea}
              className="ml-auto px-4 py-2 bg-white border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 text-sm font-medium"
            >
              Show Entire Area
            </button>
          </div>
        ) : selectedArea ? (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100 flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-gray-500">Area Mode:</span>{" "}
              <span className="font-semibold text-gray-800 ml-1">
                Showing all customers in selected area
              </span>
            </div>
            <div>
              <span className="text-gray-500">Customers:</span>{" "}
              <span className="font-semibold text-blue-700 ml-1">
                {personsInArea.length}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Area Balance:</span>{" "}
              <span className={`font-semibold ml-1 ${getBalanceClass(currentBalance)}`}>
                {formatBalance(currentBalance)}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Filter Card */}
      {selectedArea && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-wrap items-end gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From Month
              </label>
              <input
                type="text"
                value={fromMonth}
                onChange={(e) => setFromMonth(normalizeMonthInput(e.target.value))}
                placeholder="Example: 2026-06"
                className="px-4 py-3 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">Enter month like 2026-06</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To Month
              </label>
              <input
                type="text"
                value={toMonth}
                onChange={(e) => setToMonth(normalizeMonthInput(e.target.value))}
                placeholder="Example: 2026-06"
                className="px-4 py-3 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">Enter month like 2026-06</p>
            </div>
            <div className="flex gap-3 pb-0.5">
              {(fromMonth || toMonth) && (
                <button
                  onClick={clearFilters}
                  className="px-5 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition"
                >
                  Clear Filter
                </button>
              )}
              {filteredRecords.length > 0 && (
                <button
                  onClick={printRecords}
                  className="px-5 py-3 bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white rounded-lg text-sm font-medium transition"
                >
                  Print Records
                </button>
              )}
            </div>
          </div>
          {(fromMonth || toMonth) && (
            <p className="mt-3 text-xs text-gray-500">
              Showing records from <strong>{fromMonth || "start"}</strong> to{" "}
              <strong>{toMonth || "latest"}</strong> — {filteredRecords.length}{" "}
              transaction(s)
            </p>
          )}
        </div>
      )}

      {/* Summary Cards */}
      {selectedArea && filteredRecords.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              {selectedPerson ? "Transactions" : "Customers"}
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {selectedPerson ? filteredRecords.length : totalCustomers}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Total Paid
            </p>
            <p className="text-2xl font-bold text-green-700">
              Rs.{totalAmountReceived.toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              Monthly Fee Deducted
            </p>
            <p className="text-2xl font-bold text-orange-600">
              Rs.{totalMonthlyFeeDeducted.toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
              {selectedPerson ? "Balance Due" : "Area Balance"}
            </p>
            <p className={`text-2xl font-bold ${getBalanceClass(currentBalance)}`}>
              {formatBalance(currentBalance)}
            </p>
          </div>
        </div>
      )}

      {/* Records Table */}
      {selectedArea && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                Transaction Records
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {allRecords.length === 0
                  ? selectedPerson
                    ? "No transactions found for this person"
                    : "No transactions found for this area"
                  : filteredRecords.length === allRecords.length
                    ? `All ${allRecords.length} transaction(s)`
                    : `${filteredRecords.length} of ${allRecords.length} transaction(s) (filtered)`}
              </p>
            </div>
          </div>

          {allRecords.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-gray-400 text-lg mb-2">
                No transactions recorded
              </div>
              <p className="text-gray-500 text-sm">
                {selectedPerson
                  ? "This person has no payment records yet"
                  : "This area has no customer transaction records yet"}
              </p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-gray-400 text-lg mb-2">
                No records in selected range
              </div>
              <p className="text-gray-500 text-sm">
                Try widening the month range or clearing the filter
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Month
                    </th>
                    {!selectedPerson && (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Conn #
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Person Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Receipt No
                        </th>
                      </>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-orange-600 uppercase tracking-wider">
                      Monthly Fee Deducted
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount Received
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-orange-500 uppercase tracking-wider">
                      Late Fee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Collected
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Balance After
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date Recorded
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRecords.map((r, i) => (
                    <tr
                      key={r._id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {i + 1}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        {getMonthLabel(r.month)}
                        {r.isAutoMonthlyFee && (
                          <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">
                            AUTO
                          </span>
                        )}
                        {r.isCreditNote && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                            CREDIT
                          </span>
                        )}
                      </td>
                      {!selectedPerson && (
                        <>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {r.connectionNumber || "-"}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {r.personName || "-"}
                          </td>
                          <td className="px-6 py-4 text-sm text-blue-700">
                            {r.receiptNo || "-"}
                          </td>
                        </>
                      )}
                      <td className="px-6 py-4 text-sm font-medium text-orange-600">
                        {r.monthlyFeeDeducted ? formatAmount(r.monthlyFeeDeducted) : "-"}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-green-700">
                        {r.amountReceived ? formatAmount(r.amountReceived) : "-"}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">
                        {Number(r.lateFeeCharges) > 0 ? (
                          <span className="text-orange-600">
                            Rs.{Number(r.lateFeeCharges).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                        {formatAmount(r.totalCollected)}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold">
                        <span className={getBalanceClass(r.remainingAfterPayment)}>
                          {formatBalance(r.remainingAfterPayment)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {r.createdAt
                          ? new Date(r.createdAt).toLocaleDateString("en-GB")
                          : r.date || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Totals row */}
                <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                  <tr>
                    <td
                      className="px-6 py-4 text-sm font-bold text-gray-700"
                      colSpan={selectedPerson ? 2 : 5}
                    >
                      Totals
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-orange-600">
                      Rs.{totalMonthlyFeeDeducted.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-green-700">
                      Rs.{totalAmountReceived.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-orange-600">
                      {totalLateFee > 0 ? `Rs.${totalLateFee.toFixed(2)}` : "-"}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-800">
                      Rs.{(totalAmountReceived + totalLateFee).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold">
                      <span className={getBalanceClass(currentBalance)}>
                        {formatBalance(currentBalance)}
                      </span>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {!selectedArea && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
          <div className="text-gray-300 text-6xl mb-4">📋</div>
          <div className="text-gray-500 text-lg mb-1">No area selected</div>
          <p className="text-gray-400 text-sm">
            Select an area above to view all area transactions, or select a person to view individual history
          </p>
        </div>
      )}
    </div>
  );
}
