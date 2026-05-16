"use client";

import React, { useEffect, useState, useRef } from "react";
import { initDB } from "../services/db";

export default function CreditNotePage() {
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
  const [amount, setAmount] = useState<number | "">("");

  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const areaRef = useRef<HTMLInputElement>(null);
  const connectionRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  // ─── helpers ────────────────────────────────────────────────
  const getMonthsInRange = (from: string, to: string): string[] => {
    if (!from || !to) return [];
    const [fy, fm] = from.split("-").map(Number);
    const [ty, tm] = to.split("-").map(Number);
    const cur = new Date(fy, fm - 1, 1);
    const end = new Date(ty, tm - 1, 1);
    const months: string[] = [];
    while (cur <= end) {
      months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
      cur.setMonth(cur.getMonth() + 1);
    }
    return months;
  };

  const monthsInRange = fromMonth && toMonth ? getMonthsInRange(fromMonth, toMonth) : fromMonth ? [fromMonth] : [];
  const autoAmount = selectedPerson && monthsInRange.length > 0
    ? Number(selectedPerson.amount || 0) * monthsInRange.length
    : 0;

  // ─── DB setup ───────────────────────────────────────────────
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

  // ─── area select ────────────────────────────────────────────
  const onAreaSelect = async (area: any) => {
    setAreaQuery(area.name);
    setAreaSuggestions([]);
    setSelectedArea(area._id);
    setSelectedPerson(null);
    setConnectionQuery("");
    setRecords([]);
    if (!db) return;
    const persons = await db.getPersonsByArea(area._id);
    setPersonsInArea(persons || []);
  };

  // ─── person select ──────────────────────────────────────────
  const onPersonSelect = async (person: any) => {
    setSelectedPerson(person);
    setConnectionQuery(`${person.connectionNumber} — ${person.name}`);
    setConnectionSuggestions([]);
    setAmount(""); // clear so auto-amount shows
    await loadPersonCreditRecords(person._id, person.areaId);
  };

  const loadPersonCreditRecords = async (personId: string, areaId: string) => {
    if (!db) return;
    await db.localDB.createIndex({ index: { fields: ["type", "areaId"] } });
    const res = await db.localDB.find({ selector: { type: "debit", areaId } });
    const personDocs = (res.docs || [])
      .filter((r: any) => r.personId === personId && r.isCreditNote === true);
    personDocs.sort((a: any, b: any) => (a.month || "").localeCompare(b.month || ""));
    setRecords(personDocs);
  };

  // ─── submit ─────────────────────────────────────────────────
  const addCreditNote = async () => {
    if (!db || !selectedPerson) {
      alert("Please select a person first");
      return;
    }
    if (!fromMonth) {
      alert("Please select the starting month");
      return;
    }
    const toMonthValue = toMonth || fromMonth;
    if (toMonthValue < fromMonth) {
      alert("To Month cannot be earlier than From Month");
      return;
    }
    const months = getMonthsInRange(fromMonth, toMonthValue);
    if (months.length === 0) {
      alert("Invalid month range");
      return;
    }

    const totalAmount = amount !== "" ? Number(amount) : autoAmount;
    if (totalAmount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    setSaving(true);
    try {
      const person = personsInArea.find((p) => p._id === selectedPerson._id) || selectedPerson;
      const monthlyFee = Number(person.amount || 0);
      const now = new Date().toISOString();

      let remainingToAllocate = totalAmount;
      let runningBalance = Number(person.remainingBalance || 0);
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
            // last month absorbs all leftover (allows negative/credit balance)
            payForThisMonth = remainingToAllocate;
          }
        }

        const remainingAfterPayment = expectedThisMonth - payForThisMonth;
        remainingToAllocate = Math.max(0, remainingToAllocate - payForThisMonth);

        if (payForThisMonth > 0) {
          docs.push({
            _id: `credit_${selectedArea}_${person._id}_${month}_${Date.now()}_${i}`,
            type: "debit",
            isCreditNote: true,
            areaId: selectedArea,
            personId: person._id,
            personName: person.name,
            personAddress: person.address,
            personMonthlyFee: monthlyFee,
            connectionNumber: person.connectionNumber,
            receiptNo: person.receiptNo || "",
            month,
            amount: Number(payForThisMonth),
            lateFeeCharges: 0,
            expectedAmount: expectedThisMonth,
            remainingAfterPayment,
            paymentFromMonth: fromMonth,
            paymentToMonth: toMonthValue,
            createdAt: now,
          });
        }

        runningBalance = remainingAfterPayment;
      }

      // Update person balance — allow negative (credit balance)
      const updatedPerson = {
        ...person,
        remainingBalance: runningBalance,
        lastPaymentDate: now,
        updatedAt: now,
      };
      await db.localDB.put(updatedPerson);

      for (const doc of docs) {
        await db.localDB.put(doc);
      }

      // refresh persons list & records
      const refreshed = await db.getPersonsByArea(selectedArea);
      setPersonsInArea(refreshed);
      const refreshedPerson = refreshed.find((p: any) => p._id === person._id);
      if (refreshedPerson) setSelectedPerson(refreshedPerson);
      await loadPersonCreditRecords(person._id, selectedArea);

      setFromMonth("");
      setToMonth("");
      setAmount("");
      alert(`Credit note recorded! ${docs.length} month(s) prepaid.`);
    } catch (e: any) {
      alert("Failed to save credit note: " + (e?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  // ─── print ──────────────────────────────────────────────────
  const printCreditNote = () => {
    if (!selectedPerson || records.length === 0) return;
    const areaName = areas.find((a) => a._id === selectedArea)?.name || "";
    const win = window.open("", "_blank", "width=900,height=600");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head><title>Credit Note</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px}
        .hdr{text-align:center;direction:rtl;margin-bottom:12px}
        .hdr h2{font-size:22px;color:#333;margin:0}
        h1{text-align:center;font-size:18px;margin:6px 0 4px}
        .sub{text-align:center;font-size:12px;color:#666;margin:0 0 14px}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th{background:#eff6ff;padding:9px 10px;text-align:left;border-bottom:2px solid #bfdbfe;font-weight:bold}
        td{padding:8px 10px;border-bottom:1px solid #e5e7eb}
        .badge{display:inline-block;background:#dbeafe;color:#1d4ed8;font-size:11px;padding:1px 6px;border-radius:4px;font-weight:bold}
        .summary{margin-top:16px;padding:10px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;font-size:13px}
        .summary span{margin-right:20px}
      </style></head><body>
      <div class="hdr"><h2>فیملی کیبل نیٹ ورک</h2></div>
      <h1>Credit Note — Prepayment</h1>
      <p class="sub">
        Person: <b>${selectedPerson.name}</b> &nbsp;|&nbsp;
        Conn #: <b>${selectedPerson.connectionNumber}</b> &nbsp;|&nbsp;
        Receipt No: <b>${selectedPerson.receiptNo || "-"}</b> &nbsp;|&nbsp;
        Area: <b>${areaName}</b>
      </p>
      <table>
        <thead><tr>
          <th>#</th><th>Month</th><th>Amount</th><th>Balance After</th>
        </tr></thead>
        <tbody>
          ${records.map((r, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${new Date(r.month + "-01").toLocaleString("default", { month: "long", year: "numeric" })} <span class="badge">CREDIT</span></td>
              <td>Rs.${Number(r.amount || 0).toFixed(2)}</td>
              <td style="color:${Number(r.remainingAfterPayment) > 0 ? "#dc2626" : Number(r.remainingAfterPayment) < 0 ? "#16a34a" : "#6b7280"}">
                Rs.${Number(r.remainingAfterPayment || 0).toFixed(2)}
                ${Number(r.remainingAfterPayment) < 0 ? " (credit)" : ""}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div class="summary">
        <span><b>Total Prepaid:</b> Rs.${records.reduce((s, r) => s + Number(r.amount || 0), 0).toFixed(2)}</span>
        <span><b>Months Covered:</b> ${records.length}</span>
        <span><b>Current Balance:</b> Rs.${Number(selectedPerson.remainingBalance || 0).toFixed(2)}
          ${Number(selectedPerson.remainingBalance || 0) < 0 ? " (credit)" : ""}
        </span>
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

  const effectiveAmount = amount !== "" ? Number(amount) : autoAmount;
  const balanceAfterCredit = selectedPerson
    ? Number(selectedPerson.remainingBalance || 0) - effectiveAmount
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-1">Credit Note</h1>
        <p className="text-gray-500">Record advance / prepayment for one or multiple future months</p>
      </div>

      {/* Selection + Entry Form */}
      <div className="bg-white rounded-xl shadow-sm border border-blue-100 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-5">New Credit Entry</h2>

        {/* Row 1 — Area + Person */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
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
                  setAreaSuggestions(q ? areas.filter((a) => a.name.toLowerCase().includes(q.toLowerCase())).slice(0, 20) : []);
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
                      className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-800">{a.name}</li>
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
                  const ql = q.toLowerCase();
                  setConnectionSuggestions(q
                    ? personsInArea.filter((p) =>
                        String(p.connectionNumber ?? "").toLowerCase().includes(ql) ||
                        String(p.name ?? "").toLowerCase().includes(ql)
                      ).slice(0, 20)
                    : []);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && connectionSuggestions.length > 0) onPersonSelect(connectionSuggestions[0]);
                }}
                disabled={!selectedArea}
                placeholder="Type connection # or name..."
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
                      {p.receiptNo && <span className="ml-2 text-xs text-gray-400">#{p.receiptNo}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Person info strip */}
        {selectedPerson && (
          <div className="mb-5 p-4 bg-blue-50 rounded-lg border border-blue-100 flex flex-wrap gap-5 text-sm">
            <div><span className="text-gray-500">Name:</span> <span className="font-semibold text-gray-800 ml-1">{selectedPerson.name}</span></div>
            <div><span className="text-gray-500">Conn #:</span> <span className="font-semibold text-gray-800 ml-1">{selectedPerson.connectionNumber}</span></div>
            <div><span className="text-gray-500">Receipt No:</span> <span className="font-semibold text-blue-700 ml-1">{selectedPerson.receiptNo || "-"}</span></div>
            <div><span className="text-gray-500">Monthly Fee:</span> <span className="font-semibold text-gray-800 ml-1">Rs.{Number(selectedPerson.amount || 0).toFixed(2)}</span></div>
            <div>
              <span className="text-gray-500">Current Balance:</span>
              <span className={`font-semibold ml-1 ${Number(selectedPerson.remainingBalance || 0) < 0 ? "text-green-600" : Number(selectedPerson.remainingBalance || 0) > 0 ? "text-red-600" : "text-gray-600"}`}>
                Rs.{Number(selectedPerson.remainingBalance || 0).toFixed(2)}
                {Number(selectedPerson.remainingBalance || 0) < 0 && <span className="ml-1 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">credit</span>}
              </span>
            </div>
          </div>
        )}

        {/* Row 2 — Month range + Amount */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Month</label>
            <input
              type="month"
              value={fromMonth}
              onChange={(e) => setFromMonth(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Month <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              type="month"
              value={toMonth}
              min={fromMonth || undefined}
              onChange={(e) => setToMonth(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount
              {autoAmount > 0 && amount === "" && (
                <span className="ml-2 text-xs text-blue-600 font-normal">auto: Rs.{autoAmount.toFixed(2)}</span>
              )}
            </label>
            <input
              ref={amountRef}
              type="number"
              value={amount === "" ? "" : amount}
              onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
              onKeyDown={(e) => { if (e.key === "Enter") addCreditNote(); }}
              placeholder={autoAmount > 0 ? `Rs.${autoAmount.toFixed(2)}` : "0.00"}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={addCreditNote}
              disabled={saving || !selectedPerson || !fromMonth}
              className="w-full px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Add Credit Note"}
            </button>
          </div>
        </div>

        {/* Live preview */}
        {selectedPerson && fromMonth && monthsInRange.length > 0 && (
          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Months</p>
              <p className="font-bold text-gray-800 text-lg">{monthsInRange.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Monthly Fee</p>
              <p className="font-bold text-gray-800 text-lg">Rs.{Number(selectedPerson.amount || 0).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total to Collect</p>
              <p className="font-bold text-blue-700 text-lg">Rs.{effectiveAmount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Balance After</p>
              <p className={`font-bold text-lg ${balanceAfterCredit < 0 ? "text-green-600" : balanceAfterCredit > 0 ? "text-red-600" : "text-gray-600"}`}>
                Rs.{balanceAfterCredit.toFixed(2)}
                {balanceAfterCredit < 0 && <span className="ml-1 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-normal">credit</span>}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Credit records for this person */}
      {selectedPerson && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Credit Transactions — {selectedPerson.name}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{records.length} credit record(s)</p>
            </div>
            {records.length > 0 && (
              <button
                onClick={printCreditNote}
                className="px-5 py-2 bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white rounded-lg text-sm font-medium transition"
              >
                Print Credit Note
              </button>
            )}
          </div>

          {records.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-gray-300 text-5xl mb-3">💳</div>
              <p className="text-gray-500">No credit notes recorded for this person yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-blue-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-700 uppercase tracking-wider">#</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-700 uppercase tracking-wider">Month</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-700 uppercase tracking-wider">Amount Paid</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-700 uppercase tracking-wider">Balance After</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-blue-700 uppercase tracking-wider">Recorded On</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {records.map((r, i) => (
                    <tr key={r._id} className="hover:bg-blue-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-400">{i + 1}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        {r.month ? new Date(r.month + "-01").toLocaleString("default", { month: "long", year: "numeric" }) : "-"}
                        <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">CREDIT</span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-green-700">
                        Rs.{Number(r.amount || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold">
                        <span className={Number(r.remainingAfterPayment) < 0 ? "text-green-600" : Number(r.remainingAfterPayment) > 0 ? "text-red-600" : "text-gray-500"}>
                          Rs.{Number(r.remainingAfterPayment || 0).toFixed(2)}
                          {Number(r.remainingAfterPayment) < 0 && <span className="ml-1 text-xs text-green-600">(credit)</span>}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-GB") : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-blue-50 border-t-2 border-blue-200">
                  <tr>
                    <td className="px-6 py-4 text-sm font-bold text-gray-700" colSpan={2}>Total Prepaid</td>
                    <td className="px-6 py-4 text-sm font-bold text-green-700">
                      Rs.{records.reduce((s, r) => s + Number(r.amount || 0), 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold">
                      <span className={Number(selectedPerson.remainingBalance || 0) < 0 ? "text-green-600" : Number(selectedPerson.remainingBalance || 0) > 0 ? "text-red-600" : "text-gray-500"}>
                        Rs.{Number(selectedPerson.remainingBalance || 0).toFixed(2)}
                        {Number(selectedPerson.remainingBalance || 0) < 0 && <span className="ml-1 text-xs">(credit)</span>}
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
          <div className="text-gray-300 text-6xl mb-4">💳</div>
          <p className="text-gray-500 text-lg mb-1">No person selected</p>
          <p className="text-gray-400 text-sm">Select an area and a person above to record a credit note</p>
        </div>
      )}
    </div>
  );
}
