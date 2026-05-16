"use client";

import React, { useEffect, useState } from "react";
import { initDB } from "../services/db";

export default function ReportMenuPage() {
  const [db, setDb] = useState<any>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const [areaQuery, setAreaQuery] = useState("");
  const [areaSuggestions, setAreaSuggestions] = useState<any[]>([]);
  const [selectedArea, setSelectedArea] = useState("");

  const [personsInArea, setPersonsInArea] = useState<any[]>([]);
  const [connectionQuery, setConnectionQuery] = useState("");
  const [connectionSuggestions, setConnectionSuggestions] = useState<any[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [selectedPersonName, setSelectedPersonName] = useState("");
  const [selectedPersonAddress, setSelectedPersonAddress] = useState("");
  const [selectedPersonFee, setSelectedPersonFee] = useState<number | "">("");
  const [selectedPersonCreatedAt, setSelectedPersonCreatedAt] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [records, setRecords] = useState<any[]>([]);
  const [displayRows, setDisplayRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Helpers
  const getMonthString = (date: Date) => date.toISOString().slice(0, 7);
  const getPreviousMonth = (month: string) => {
    const [year, mon] = month.split('-').map(Number);
    const prevDate = new Date(year, mon - 1, 1);
    prevDate.setMonth(prevDate.getMonth() - 1);
    return getMonthString(prevDate);
  };
  const calculateMonthsBetween = (start: string, end: string) => {
    const [startYear, startMonth] = start.split('-').map(Number);
    const [endYear, endMonth] = end.split('-').map(Number);
    return (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
  };

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

  const onAreaChange = async (areaId: string) => {
    setSelectedArea(areaId);
    setSelectedPersonId("");
    setSelectedPersonName("");
    setSelectedPersonAddress("");
    setSelectedPersonFee("");
    setRecords([]);
    setConnectionQuery("");
    setConnectionSuggestions([]);
    setSelectedMonth("");
    if (!db || !areaId) return;
    try {
      const p = await db.getPersonsByArea(areaId);
      setPersonsInArea(p || []);
      await loadRecords(areaId);
    } catch (e) {
      console.warn("failed to load persons/records", e);
    }
  };

  const onPersonSelect = (personId: string) => {
    setSelectedPersonId(personId);
    const person = personsInArea.find((x) => x._id === personId);
    if (person) {
      setSelectedPersonName(person?.name || "");
      setSelectedPersonAddress(person?.address || "");
      setSelectedPersonFee(person?.amount || "");
      setSelectedPersonCreatedAt(person?.createdAt ?? null);
      setConnectionQuery(person ? String(person.connectionNumber ?? person.number ?? person.name ?? "") : "");
      setConnectionSuggestions([]);
    }
  };

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

  // Compute display rows (all persons, with pending logic)
  useEffect(() => {
    if (!selectedArea || personsInArea.length === 0) {
      setDisplayRows([]);
      return;
    }

    const rows = personsInArea.map((person) => {
      const monthlyFee = Number(person.amount || 0);
      const personRecords = records.filter((r: any) => r.personId === person._id);

      let prevMonth;
      if (selectedMonth) {
        prevMonth = getPreviousMonth(selectedMonth);
      } else {
        const today = new Date();
        const currentMonthStr = getMonthString(today);
        prevMonth = getPreviousMonth(currentMonthStr);
      }

      const startMonth = getMonthString(new Date(person.createdAt || new Date()));
      const monthsUpToPrev = calculateMonthsBetween(startMonth, prevMonth);
      const totalExpectedUpToPrev = monthlyFee * monthsUpToPrev;

      const paidUpToPrev = personRecords
        .filter((r: any) => {
          const rMonth = r.month || getMonthString(new Date(r.createdAt));
          return rMonth <= prevMonth;
        })
        .reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);

      const previousRemaining = Math.max(0, totalExpectedUpToPrev - paidUpToPrev);

      let paidThisMonth = 0;
      let pendingThisMonth = previousRemaining;
      let monthDisplayed = "Up to now";

      if (selectedMonth) {
        paidThisMonth = personRecords
          .filter((r: any) => r.month === selectedMonth)
          .reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);

        const expectedThisMonth = monthlyFee + previousRemaining;
        pendingThisMonth = Math.max(0, expectedThisMonth - paidThisMonth);
        monthDisplayed = selectedMonth;
      }

      return {
        _id: person._id + "_computed_" + (selectedMonth || "all"),
        personId: person._id,
        personName: person.name,
        connectionNumber: person.connectionNumber || "-",
        personAddress: person.address || "-",
        personMonthlyFee: monthlyFee,
        month: monthDisplayed,
        amount: paidThisMonth,
        remainingAfterPayment: pendingThisMonth,
        isComputed: paidThisMonth === 0,
      };
    });

    setDisplayRows(rows);
  }, [selectedArea, selectedMonth, personsInArea, records]);

  // Print function - prints the visible monthly view (all persons)
  const printRecords = () => {
    const printWindow = window.open('', '', 'width=1200,height=600');
    if (!printWindow) return;

    const toPrint = displayRows;

    if (toPrint.length === 0) {
      alert("No records to print for the current view");
      return;
    }

    const title = selectedMonth
      ? `Family Cable Network - Monthly Report (${new Date(selectedMonth + "-01").toLocaleString('default', { month: 'long', year: 'numeric' })})`
      : "Family Cable Network - Running Balances";

    const tableHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
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
        <h2>${title}</h2>
        <table>
          <thead>
            <tr>
              <th>Person</th>
              <th>Connection #</th>
              <th>Address</th>
              <th>Monthly Fee</th>
              <th>Month</th>
              <th class="amount">Amount Received</th>
              <th class="amount">Pending / Balance Due</th>
            </tr>
          </thead>
          <tbody>
            ${toPrint.map((r) => `
              <tr>
                <td>${r.personName || '-'}</td>
                <td>${r.connectionNumber || '-'}</td>
                <td>${r.personAddress || '-'}</td>
                <td class="amount">Rs.${Number(r.personMonthlyFee ?? 0).toFixed(2)}</td>
                <td>${r.month}</td>
                <td class="amount">Rs.${Number(r.amount ?? 0).toFixed(2)}</td>
                <td class="pending">Rs.${Number(r.remainingAfterPayment ?? 0).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <script>window.print();</script>
      </body>
      </html>
    `;

    printWindow.document.write(tableHTML);
    printWindow.document.close();
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
        <h1 className="text-2xl font-bold text-black">Report Menu</h1>
        <p className="text-sm text-gray-600">View balances and payment history (read-only)</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Area</label>
            <div className="relative">
              <input
                type="text"
                value={areaQuery}
                onChange={(e) => {
                  const q = String(e.target.value || "");
                  setAreaQuery(q);
                  if (!q) {
                    setAreaSuggestions([]);
                    return;
                  }
                  const qLower = q.toLowerCase();
                  const filtered = areas.filter((ar) => String(ar.name || "").toLowerCase().startsWith(qLower));
                  setAreaSuggestions(filtered.slice(0, 20));
                }}
                placeholder="Type area name (optional)"
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Connection / Name</label>
            <div className="relative">
              <input
                type="text"
                value={connectionQuery}
                onChange={(e) => {
                  const q = String(e.target.value || "");
                  setConnectionQuery(q);
                  if (!q) {
                    setConnectionSuggestions([]);
                    return;
                  }
                  const qLower = q.toLowerCase();
                  const filtered = personsInArea.filter((p) => {
                    const conn = String(p.connectionNumber ?? p.number ?? p.name ?? "");
                    return conn.toLowerCase().startsWith(qLower) || String(p.name || "").toLowerCase().startsWith(qLower);
                  });
                  setConnectionSuggestions(filtered.slice(0, 20));
                }}
                placeholder="Type connection # or name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
              />

              {connectionSuggestions.length > 0 && (
                <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded max-h-44 overflow-auto shadow-lg">
                  {connectionSuggestions.map((p) => {
                    const label = p.connectionNumber ?? p.number ?? p.name ?? "";
                    return (
                      <li
                        key={p._id}
                        onClick={() => onPersonSelect(p._id)}
                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-black"
                      >
                        {label}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Person Name</label>
            <input
              type="text"
              value={selectedPersonName}
              readOnly
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
            <input
              type="text"
              value={selectedPersonAddress}
              readOnly
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-black"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Fee</label>
            <input
              type="text"
              value={selectedPersonFee === "" ? "" : `Rs.${Number(selectedPersonFee).toFixed(2)}`}
              readOnly
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-black"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-1 gap-4 mt-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Month (optional)</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
            />
          </div>
        </div>
      </div>

      {/* Records Table - Read-only view */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">
            Monthly Report
            {selectedMonth && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                (for {new Date(selectedMonth + "-01").toLocaleString('default', { month: 'long', year: 'numeric' })})
              </span>
            )}
          </h2>

          {displayRows.length > 0 && (
            <button
              onClick={printRecords}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition"
            >
              Print Monthly List
            </button>
          )}
        </div>

        {displayRows.length === 0 ? (
          <div className="text-sm text-gray-500">Select an area to view records</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Person</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Connection #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monthly Fee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount Received</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pending / Balance Due</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayRows.map((row: any) => (
                  <tr key={row._id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-900">{row.personName}</td>
                    <td className="px-6 py-3 text-sm text-gray-900">{row.connectionNumber || '-'}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">{row.personAddress || '-'}</td>
                    <td className="px-6 py-3 text-sm text-gray-500">
                      Rs.{Number(row.personMonthlyFee).toFixed(2)}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-500">{row.month}</td>
                    <td className="px-6 py-3 text-sm text-gray-900 font-medium">
                      Rs.{Number(row.amount).toFixed(2)}
                    </td>
                    <td className="px-6 py-3 text-sm text-red-600 font-semibold">
                      Rs.{Number(row.remainingAfterPayment).toFixed(2)}
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