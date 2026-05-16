"use client";

import React, { useEffect, useState, useRef } from "react";
import { initDB } from "../services/db";

export default function PersonRecordsPage() {
  const [db, setDb] = useState<any>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const [selectedArea, setSelectedArea] = useState("");
  const [areaQuery, setAreaQuery] = useState("");
  const [areaSuggestions, setAreaSuggestions] = useState<any[]>([]);

  const [personsInArea, setPersonsInArea] = useState<any[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [connectionQuery, setConnectionQuery] = useState("");
  const [connectionSuggestions, setConnectionSuggestions] = useState<any[]>([]);

  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");

  const [allRecords, setAllRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const areaRef = useRef<HTMLInputElement>(null);
  const connectionRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const setup = async () => {
      const pouch = await initDB();
      if (!pouch) return;
      pouch.syncDB();
      setDb(pouch);
      const a = await pouch.getAreas();
      setAreas(a || []);
      setLoading(false);
    };
    setup();
  }, []);

  const onAreaSelect = async (area: any) => {
    setAreaQuery(area.name);
    setAreaSuggestions([]);
    setSelectedArea(area._id);
    setSelectedPerson(null);
    setConnectionQuery("");
    setConnectionSuggestions([]);
    setAllRecords([]);
    if (!db) return;
    const persons = await db.getPersonsByArea(area._id);
    setPersonsInArea(persons || []);
  };

  const onPersonSelect = async (person: any) => {
    setSelectedPerson(person);
    setConnectionQuery(`${person.connectionNumber} — ${person.name}`);
    setConnectionSuggestions([]);
    if (!db) return;
    await loadPersonRecords(person._id, person.areaId);
  };

  const loadPersonRecords = async (personId: string, areaId: string) => {
    if (!db) return;
    await db.localDB.createIndex({ index: { fields: ["type", "areaId"] } });
    const res = await db.localDB.find({ selector: { type: "debit", areaId } });
    const personDocs = (res.docs || []).filter((r: any) => r.personId === personId);
    personDocs.sort((a: any, b: any) => (a.month || "").localeCompare(b.month || ""));
    setAllRecords(personDocs);
  };

  const filteredRecords = allRecords.filter((r) => {
    const m = r.month || "";
    if (fromMonth && m < fromMonth) return false;
    if (toMonth && m > toMonth) return false;
    return true;
  });

  const totalAmountReceived = filteredRecords.reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalLateFee = filteredRecords.reduce((s, r) => s + Number(r.lateFeeCharges || 0), 0);
  const lastRecord = filteredRecords[filteredRecords.length - 1];
  const currentBalance = lastRecord ? Number(lastRecord.remainingAfterPayment || 0) : 0;

  const clearFilters = () => {
    setFromMonth("");
    setToMonth("");
  };

  const printRecords = () => {
    if (!selectedPerson || filteredRecords.length === 0) return;
    const win = window.open("", "_blank", "width=900,height=600");
    if (!win) return;
    const areaName = areas.find((a) => a._id === selectedArea)?.name || "";
    win.document.write(`
      <!DOCTYPE html><html><head><title>Person Records</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; }
        .header { text-align:center; margin-bottom:20px; direction:rtl; }
        .header h2 { font-size:22px; color:#333; margin:0; }
        .meta { margin-bottom:16px; font-size:13px; color:#555; }
        table { width:100%; border-collapse:collapse; margin-top:16px; font-size:13px; }
        th { background:#f4f4f4; padding:9px 10px; text-align:left; border-bottom:2px solid #ddd; font-weight:bold; }
        td { padding:8px 10px; border-bottom:1px solid #eee; }
        .orange { color:#c05300; font-weight:bold; }
        .red { color:#dc2626; font-weight:bold; }
        .summary { margin-top:18px; padding:12px; background:#f9f9f9; border:1px solid #e5e5e5; border-radius:6px; font-size:13px; }
        .summary span { margin-right:24px; }
      </style></head><body>
      <div class="header"><h2>فیملی کیبل نیٹ ورک</h2></div>
      <div class="meta">
        <strong>Person:</strong> ${selectedPerson.name} &nbsp;|&nbsp;
        <strong>Conn #:</strong> ${selectedPerson.connectionNumber} &nbsp;|&nbsp;
        <strong>Receipt No:</strong> ${selectedPerson.receiptNo || "-"} &nbsp;|&nbsp;
        <strong>Area:</strong> ${areaName} &nbsp;|&nbsp;
        <strong>Period:</strong> ${fromMonth || "Start"} → ${toMonth || "Latest"}
      </div>
      <table>
        <thead><tr>
          <th>Month</th>
          <th>Amount Received</th>
          <th>Late Fee</th>
          <th>Total Collected</th>
          <th>Pending / Balance</th>
        </tr></thead>
        <tbody>
          ${filteredRecords.map((r) => `
            <tr>
              <td>${r.month || "-"}</td>
              <td>Rs.${Number(r.amount || 0).toFixed(2)}</td>
              <td class="orange">${Number(r.lateFeeCharges) > 0 ? "Rs." + Number(r.lateFeeCharges).toFixed(2) : "-"}</td>
              <td>Rs.${(Number(r.amount || 0) + Number(r.lateFeeCharges || 0)).toFixed(2)}</td>
              <td class="red">Rs.${Number(r.remainingAfterPayment || 0).toFixed(2)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div class="summary">
        <span><strong>Total Received:</strong> Rs.${totalAmountReceived.toFixed(2)}</span>
        <span><strong>Total Late Fee:</strong> Rs.${totalLateFee.toFixed(2)}</span>
        <span><strong>Current Balance Due:</strong> Rs.${currentBalance.toFixed(2)}</span>
      </div>
      <script>window.onload=function(){window.print();setTimeout(()=>window.close(),1000);}</script>
      </body></html>
    `);
    win.document.close();
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-lg text-gray-600">Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-1">Person Transaction History</h1>
        <p className="text-gray-500">View all payment records for any person, filtered by month range</p>
      </div>

      {/* Selection Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Select Person</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Area */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Area</label>
            <div className="relative">
              <input
                ref={areaRef}
                type="text"
                value={areaQuery}
                onChange={(e) => {
                  const q = e.target.value;
                  setAreaQuery(q);
                  if (!q) { setAreaSuggestions([]); return; }
                  setAreaSuggestions(areas.filter((a) => a.name.toLowerCase().includes(q.toLowerCase())).slice(0, 20));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && areaSuggestions.length > 0) {
                    onAreaSelect(areaSuggestions[0]);
                    setTimeout(() => connectionRef.current?.focus(), 100);
                  }
                }}
                placeholder="Type area name..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400"
              />
              {areaSuggestions.length > 0 && (
                <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg max-h-44 overflow-auto shadow-lg">
                  {areaSuggestions.map((a) => (
                    <li key={a._id} onClick={() => { onAreaSelect(a); setTimeout(() => connectionRef.current?.focus(), 100); }}
                      className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-800">
                      {a.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Person */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Connection # / Name</label>
            <div className="relative">
              <input
                ref={connectionRef}
                type="text"
                value={connectionQuery}
                onChange={(e) => {
                  const q = e.target.value;
                  setConnectionQuery(q);
                  if (!q) { setConnectionSuggestions([]); return; }
                  const ql = q.toLowerCase();
                  setConnectionSuggestions(
                    personsInArea.filter((p) =>
                      String(p.connectionNumber ?? "").toLowerCase().includes(ql) ||
                      String(p.name ?? "").toLowerCase().includes(ql)
                    ).slice(0, 20)
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
                    <li key={p._id} onClick={() => onPersonSelect(p)}
                      className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-800">
                      <span className="font-medium text-blue-700">{p.connectionNumber}</span>
                      <span className="mx-2 text-gray-400">—</span>
                      {p.name}
                      {p.receiptNo && <span className="ml-2 text-xs text-gray-400">Receipt: {p.receiptNo}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Person info strip */}
        {selectedPerson && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100 flex flex-wrap gap-6 text-sm">
            <div><span className="text-gray-500">Name:</span> <span className="font-semibold text-gray-800 ml-1">{selectedPerson.name}</span></div>
            <div><span className="text-gray-500">Conn #:</span> <span className="font-semibold text-gray-800 ml-1">{selectedPerson.connectionNumber}</span></div>
            <div><span className="text-gray-500">Receipt No:</span> <span className="font-semibold text-blue-700 ml-1">{selectedPerson.receiptNo || "-"}</span></div>
            <div><span className="text-gray-500">Address:</span> <span className="font-semibold text-gray-800 ml-1">{selectedPerson.address || "-"}</span></div>
            <div><span className="text-gray-500">Monthly Fee:</span> <span className="font-semibold text-gray-800 ml-1">Rs.{Number(selectedPerson.amount || 0).toFixed(2)}</span></div>
            <div><span className="text-gray-500">Current Balance:</span> <span className={`font-semibold ml-1 ${Number(selectedPerson.remainingBalance || 0) > 0 ? "text-red-600" : "text-green-600"}`}>Rs.{Number(selectedPerson.remainingBalance || 0).toFixed(2)}</span></div>
          </div>
        )}
      </div>

      {/* Filter Card */}
      {selectedPerson && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-wrap items-end gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From Month</label>
              <input
                type="month"
                value={fromMonth}
                onChange={(e) => setFromMonth(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">To Month</label>
              <input
                type="month"
                value={toMonth}
                min={fromMonth || undefined}
                onChange={(e) => setToMonth(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
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
              Showing records from <strong>{fromMonth || "start"}</strong> to <strong>{toMonth || "latest"}</strong> — {filteredRecords.length} transaction(s)
            </p>
          )}
        </div>
      )}

      {/* Summary Cards */}
      {selectedPerson && filteredRecords.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Transactions</p>
            <p className="text-2xl font-bold text-gray-900">{filteredRecords.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Total Received</p>
            <p className="text-2xl font-bold text-green-700">Rs.{totalAmountReceived.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Total Late Fee</p>
            <p className="text-2xl font-bold text-orange-600">Rs.{totalLateFee.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Balance Due</p>
            <p className={`text-2xl font-bold ${currentBalance > 0 ? "text-red-600" : "text-green-600"}`}>
              Rs.{currentBalance.toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Records Table */}
      {selectedPerson && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Transaction Records</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {allRecords.length === 0
                  ? "No transactions found for this person"
                  : filteredRecords.length === allRecords.length
                  ? `All ${allRecords.length} transaction(s)`
                  : `${filteredRecords.length} of ${allRecords.length} transaction(s) (filtered)`}
              </p>
            </div>
          </div>

          {allRecords.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-gray-400 text-lg mb-2">No transactions recorded</div>
              <p className="text-gray-500 text-sm">This person has no payment records yet</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-gray-400 text-lg mb-2">No records in selected range</div>
              <p className="text-gray-500 text-sm">Try widening the month range or clearing the filter</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount Received</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-orange-500 uppercase tracking-wider">Late Fee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Collected</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance After</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Recorded</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRecords.map((r, i) => (
                    <tr key={r._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-400">{i + 1}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        {r.month
                          ? new Date(r.month + "-01").toLocaleString("default", { month: "long", year: "numeric" })
                          : "-"}
                        {r.isCreditNote && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">CREDIT</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-green-700">
                        Rs.{Number(r.amount || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">
                        {Number(r.lateFeeCharges) > 0
                          ? <span className="text-orange-600">Rs.{Number(r.lateFeeCharges).toFixed(2)}</span>
                          : <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                        Rs.{(Number(r.amount || 0) + Number(r.lateFeeCharges || 0)).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold">
                        <span className={Number(r.remainingAfterPayment || 0) > 0 ? "text-red-600" : "text-green-600"}>
                          Rs.{Number(r.remainingAfterPayment || 0).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-GB") : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Totals row */}
                <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                  <tr>
                    <td className="px-6 py-4 text-sm font-bold text-gray-700" colSpan={2}>Totals</td>
                    <td className="px-6 py-4 text-sm font-bold text-green-700">Rs.{totalAmountReceived.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm font-bold text-orange-600">
                      {totalLateFee > 0 ? `Rs.${totalLateFee.toFixed(2)}` : "-"}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-800">
                      Rs.{(totalAmountReceived + totalLateFee).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold">
                      <span className={currentBalance > 0 ? "text-red-600" : "text-green-600"}>
                        Rs.{currentBalance.toFixed(2)}
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

      {!selectedPerson && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
          <div className="text-gray-300 text-6xl mb-4">📋</div>
          <div className="text-gray-500 text-lg mb-1">No person selected</div>
          <p className="text-gray-400 text-sm">Select an area and a person above to view their full transaction history</p>
        </div>
      )}
    </div>
  );
}
