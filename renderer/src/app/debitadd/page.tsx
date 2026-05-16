"use client";
import React, { useEffect, useState, useRef } from "react";
import { initDB } from "../services/db";

// ─── Schema for a customer debit/purchase entry ───────────────────────────
// {
//   _id: `customer_debit_${areaId}_${personId}_${Date.now()}`,
//   type: "customer-debit",
//   areaId: string,
//   personId: string,
//   connectionNumber: string,
//   personName: string,
//   personAddress: string,
//   receiptNo: string,
//   date: string,           // YYYY-MM-DD
//   amount: number,
//   description: string,    // what customer bought
//   status: "unpaid" | "paid",
//   createdAt: string,
// }

export default function DebitAddPage() {
  const [db, setDb] = useState<any>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const [personsInArea, setPersonsInArea] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Area search
  const [areaQuery, setAreaQuery] = useState("");
  const [areaSuggestions, setAreaSuggestions] = useState<any[]>([]);
  const [selectedArea, setSelectedArea] = useState("");

  // Connection search
  const [connQuery, setConnQuery] = useState("");
  const [connSuggestions, setConnSuggestions] = useState<any[]>([]);

  // Auto-filled person fields
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [personName, setPersonName] = useState("");
  const [personAddress, setPersonAddress] = useState("");
  const [receiptNo, setReceiptNo] = useState("");

  // Form fields
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState<number | "">("");
  const [description, setDescription] = useState("");

  // Previous debits for this person
  const [debitRecords, setDebitRecords] = useState<any[]>([]);
  const [loadingDebits, setLoadingDebits] = useState(false);

  // Refs for keyboard navigation
  const areaRef = useRef<HTMLInputElement>(null);
  const connRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  // ─── Init ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const setup = async () => {
      const pouch = await initDB();
      if (!pouch) return;
      setDb(pouch);
      try {
        const a = await pouch.getAreas();
        setAreas(a || []);
      } catch (e) {
        console.warn("Failed to load areas", e);
      }
      setLoading(false);
    };
    setup();
  }, []);

  // ─── Area selection ─────────────────────────────────────────────────────
  const onAreaSelect = async (area: any) => {
    setAreaQuery(area.name);
    setAreaSuggestions([]);
    setSelectedArea(area._id);

    // Reset person fields
    setConnQuery("");
    setSelectedPersonId("");
    setPersonName("");
    setPersonAddress("");
    setReceiptNo("");
    setDebitRecords([]);

    if (!db) return;
    try {
      const persons = await db.getPersonsByArea(area._id);
      setPersonsInArea(persons || []);
    } catch (e) {
      console.warn("Failed to load persons", e);
    }
  };

  // ─── Person selection ───────────────────────────────────────────────────
  const onPersonSelect = async (person: any) => {
    setSelectedPersonId(person._id);
    setPersonName(person.name || "");
    setPersonAddress(person.address || "");
    setReceiptNo(person.receiptNo || "");
    setConnQuery(String(person.connectionNumber ?? ""));
    setConnSuggestions([]);

    // Load previous debits for this person
    await loadPersonDebits(person._id);
    setTimeout(() => dateRef.current?.focus(), 100);
  };

  // ─── Load previous debits ───────────────────────────────────────────────
  const loadPersonDebits = async (personId: string) => {
    if (!db) return;
    setLoadingDebits(true);
    try {
      const res = await db.localDB.allDocs({ include_docs: true });
      const debits = res.rows
        .map((r: any) => r.doc)
        .filter(
          (doc: any) =>
            doc &&
            !doc._deleted &&
            doc.type === "customer-debit" &&
            doc.personId === personId
        )
        .sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      setDebitRecords(debits);
    } catch (e) {
      console.warn("Failed to load debits", e);
    }
    setLoadingDebits(false);
  };

  // ─── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedArea) { alert("Please select an area"); return; }
    if (!selectedPersonId) { alert("Please select a connection / person"); return; }
    if (!date) { alert("Please select a date"); return; }
    if (amount === "" || Number(amount) <= 0) { alert("Please enter a valid amount"); return; }
    if (!description.trim()) { alert("Please enter a description (what was purchased)"); return; }

    setSubmitting(true);
    try {
      const doc = {
        _id: `customer_debit_${selectedArea}_${selectedPersonId}_${Date.now()}`,
        type: "customer-debit",
        areaId: selectedArea,
        personId: selectedPersonId,
        connectionNumber: connQuery,
        personName,
        personAddress,
        receiptNo,
        date,
        amount: Number(amount),
        description: description.trim(),
        status: "unpaid",
        createdAt: new Date().toISOString(),
      };

      await db.localDB.put(doc);
      await loadPersonDebits(selectedPersonId);

      // Reset only transaction fields
      setAmount("");
      setDescription("");
      setDate(new Date().toISOString().slice(0, 10));

      alert("Debit entry saved successfully!");
    } catch (e: any) {
      alert("Failed to save: " + (e?.message || "Unknown error"));
    }
    setSubmitting(false);
  };

  // ─── Delete debit ────────────────────────────────────────────────────────
  const deleteDebit = async (record: any) => {
    if (!confirm(`Delete debit of Rs.${record.amount} for "${record.description}"?`)) return;
    try {
      await db.localDB.remove(record);
      await loadPersonDebits(selectedPersonId);
    } catch (e: any) {
      alert("Failed to delete: " + (e?.message || "Unknown error"));
    }
  };

  // ─── Toggle paid status ──────────────────────────────────────────────────
  const togglePaid = async (record: any) => {
    try {
      const updated = {
        ...record,
        status: record.status === "paid" ? "unpaid" : "paid",
        updatedAt: new Date().toISOString(),
      };
      await db.localDB.put(updated);
      await loadPersonDebits(selectedPersonId);
    } catch (e: any) {
      alert("Failed to update: " + (e?.message || "Unknown error"));
    }
  };

  // ─── Print ───────────────────────────────────────────────────────────────
  const printDebits = () => {
    const win = window.open("", "_blank", "width=900,height=600");
    if (!win) return;
    const totalUnpaid = debitRecords
      .filter((r) => r.status !== "paid")
      .reduce((s, r) => s + Number(r.amount || 0), 0);

    win.document.write(`
      <!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>Customer Debit — ${personName}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
        .header { text-align: center; margin-bottom: 20px; direction: rtl; }
        .header h2 { font-size: 22px; margin: 0; }
        .sub { text-align: center; margin-bottom: 16px; font-size: 14px; color: #444; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #f3f4f6; padding: 10px; text-align: left; font-size: 12px; border-bottom: 2px solid #ddd; }
        td { padding: 9px 10px; border-bottom: 1px solid #eee; font-size: 13px; }
        .unpaid { color: #dc2626; font-weight: bold; }
        .paid { color: #16a34a; }
        .total { text-align: right; margin-top: 14px; font-weight: bold; font-size: 15px; color: #dc2626; }
      </style></head><body>
      <div class="header"><h2>فیملی کیبل نیٹ ورک</h2></div>
      <div class="sub">
        <strong>Customer:</strong> ${personName} &nbsp;|&nbsp;
        <strong>Conn #:</strong> ${connQuery} &nbsp;|&nbsp;
        <strong>Address:</strong> ${personAddress} &nbsp;|&nbsp;
        <strong>Receipt No:</strong> ${receiptNo}
      </div>
      <table>
        <thead><tr>
          <th>#</th><th>Date</th><th>Description</th>
          <th>Amount</th><th>Status</th>
        </tr></thead>
        <tbody>
          ${debitRecords.map((r, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${r.date || "-"}</td>
              <td>${r.description}</td>
              <td>Rs.${Number(r.amount).toFixed(2)}</td>
              <td class="${r.status === "paid" ? "paid" : "unpaid"}">
                ${r.status === "paid" ? "Paid" : "Unpaid"}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div class="total">Total Unpaid: Rs.${totalUnpaid.toFixed(2)}</div>
      <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1000);}</script>
      </body></html>
    `);
    win.document.close();
  };

  const totalUnpaid = debitRecords
    .filter((r) => r.status !== "paid")
    .reduce((s, r) => s + Number(r.amount || 0), 0);

  const totalAll = debitRecords.reduce((s, r) => s + Number(r.amount || 0), 0);

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-lg text-gray-600">Loading Database...</div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-1">Customer Debit / Purchase Entry</h1>
        <p className="text-gray-500 text-sm">Record what a customer purchased on credit</p>
      </div>

      {/* ── Form card ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-7 mb-8">
        <h2 className="text-lg font-semibold text-gray-700 mb-6 pb-3 border-b border-gray-100">
          Bill Details
        </h2>

        {/* Row 1: Area + Connection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Area */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Area <span className="text-red-500">*</span></label>
            <div className="relative">
              <input
                ref={areaRef}
                type="text"
                value={areaQuery}
                onChange={(e) => {
                  const q = e.target.value;
                  setAreaQuery(q);
                  if (!q.trim()) { setAreaSuggestions([]); return; }
                  setAreaSuggestions(
                    areas.filter((a) =>
                      a.name.toLowerCase().startsWith(q.toLowerCase())
                    ).slice(0, 15)
                  );
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && areaSuggestions.length > 0) {
                    e.preventDefault();
                    onAreaSelect(areaSuggestions[0]);
                    setTimeout(() => connRef.current?.focus(), 100);
                  }
                }}
                placeholder="Type area name..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400"
              />
              {areaSuggestions.length > 0 && (
                <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl max-h-48 overflow-auto shadow-xl">
                  {areaSuggestions.map((a) => (
                    <li
                      key={a._id}
                      onClick={() => { onAreaSelect(a); setTimeout(() => connRef.current?.focus(), 100); }}
                      className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer text-sm text-gray-800 border-b border-gray-50 last:border-0"
                    >
                      {a.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Connection Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Connection # <span className="text-red-500">*</span></label>
            <div className="relative">
              <input
                ref={connRef}
                type="text"
                value={connQuery}
                onChange={(e) => {
                  const q = e.target.value;
                  setConnQuery(q);
                  setSelectedPersonId("");
                  setPersonName("");
                  setPersonAddress("");
                  setReceiptNo("");
                  if (!q.trim() || !selectedArea) { setConnSuggestions([]); return; }
                  const qLower = q.toLowerCase();
                  setConnSuggestions(
                    personsInArea.filter((p) =>
                      String(p.connectionNumber ?? "").toLowerCase().includes(qLower) ||
                      String(p.name ?? "").toLowerCase().includes(qLower)
                    ).slice(0, 15)
                  );
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && connSuggestions.length > 0) {
                    e.preventDefault();
                    onPersonSelect(connSuggestions[0]);
                  }
                }}
                placeholder={selectedArea ? "Type conn # or name..." : "Select area first"}
                disabled={!selectedArea}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400 disabled:bg-gray-50 disabled:text-gray-400"
              />
              {connSuggestions.length > 0 && (
                <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl max-h-56 overflow-auto shadow-xl">
                  {connSuggestions.map((p) => (
                    <li
                      key={p._id}
                      onClick={() => onPersonSelect(p)}
                      className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-800">
                          Conn #{p.connectionNumber ?? "-"} — {p.name}
                        </span>
                        {p.receiptNo && (
                          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                            #{p.receiptNo}
                          </span>
                        )}
                      </div>
                      {p.address && p.address !== "-" && (
                        <div className="text-xs text-gray-400 mt-0.5 truncate">{p.address}</div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Auto-filled person info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Customer Name</label>
            <input
              type="text"
              value={personName}
              readOnly
              placeholder="Auto-filled from connection"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-blue-50 text-gray-700 placeholder-gray-400 cursor-default"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
            <input
              type="text"
              value={personAddress}
              readOnly
              placeholder="Auto-filled from connection"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-blue-50 text-gray-700 placeholder-gray-400 cursor-default"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Receipt No</label>
            <input
              type="text"
              value={receiptNo}
              readOnly
              placeholder="Auto-filled from connection"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-blue-50 text-gray-700 placeholder-gray-400 cursor-default"
            />
          </div>
        </div>

        {/* Row 3: Date, Amount, Description */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date <span className="text-red-500">*</span></label>
            <input
              ref={dateRef}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); amountRef.current?.focus(); }
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Amount (Rs.) <span className="text-red-500">*</span></label>
            <input
              ref={amountRef}
              type="number"
              value={amount === "" ? "" : amount}
              onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); descRef.current?.focus(); }
              }}
              placeholder="0.00"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description / Item Purchased <span className="text-red-500">*</span>
            </label>
            <textarea
              ref={descRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="e.g. Cable wire 50m, Connector box, Installation charges..."
              rows={1}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400 resize-none"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-4 items-center">
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedPersonId}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl hover:from-blue-700 hover:to-indigo-800 transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {submitting ? "Saving..." : "Save Debit Entry"}
          </button>

          {selectedPersonId && debitRecords.length > 0 && (
            <button
              onClick={printDebits}
              className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-700 text-white rounded-xl hover:from-green-700 hover:to-emerald-800 transition-all duration-200 font-semibold shadow-sm"
            >
              Print Statement
            </button>
          )}

          {/* Selected person badge */}
          {selectedPersonId && (
            <div className="flex items-center gap-2 ml-auto px-4 py-2 bg-green-50 border border-green-200 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-sm text-green-700 font-medium">{personName}</span>
              <span className="text-xs text-green-500">Conn #{connQuery}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Previous debit records table ── */}
      {selectedPersonId && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Table header */}
          <div className="px-7 py-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                Debit History — {personName}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Conn #{connQuery} &nbsp;·&nbsp; {personAddress} &nbsp;·&nbsp; Receipt #{receiptNo}
              </p>
            </div>

            {/* Summary pills */}
            <div className="flex gap-3">
              <div className="px-4 py-2 bg-gray-50 rounded-xl border border-gray-200 text-center">
                <div className="text-xs text-gray-400">Total Billed</div>
                <div className="text-sm font-bold text-gray-800">Rs.{totalAll.toFixed(2)}</div>
              </div>
              <div className="px-4 py-2 bg-red-50 rounded-xl border border-red-100 text-center">
                <div className="text-xs text-red-400">Unpaid</div>
                <div className="text-sm font-bold text-red-600">Rs.{totalUnpaid.toFixed(2)}</div>
              </div>
              <div className="px-4 py-2 bg-green-50 rounded-xl border border-green-100 text-center">
                <div className="text-xs text-green-500">Paid</div>
                <div className="text-sm font-bold text-green-700">Rs.{(totalAll - totalUnpaid).toFixed(2)}</div>
              </div>
            </div>
          </div>

          {loadingDebits ? (
            <div className="p-10 text-center text-gray-400">Loading records...</div>
          ) : debitRecords.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-gray-300 text-4xl mb-3">📋</div>
              <div className="text-gray-400 text-sm">No debit records yet for this customer</div>
              <p className="text-gray-300 text-xs mt-1">Add the first entry above</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {["#", "Date", "Description / Item", "Amount", "Status", "Actions"].map((h) => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {debitRecords.map((record, idx) => (
                    <tr
                      key={record._id}
                      className={`hover:bg-gray-50 transition-colors ${record.status === "paid" ? "opacity-60" : ""}`}
                    >
                      <td className="px-6 py-4 text-sm text-gray-400 font-mono">{idx + 1}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                        {record.date
                          ? new Date(record.date).toLocaleDateString("en-PK", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 max-w-xs">
                        <div className="font-medium">{record.description}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          Added {new Date(record.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-bold ${record.status === "paid" ? "text-gray-500 line-through" : "text-red-600"}`}>
                          Rs.{Number(record.amount).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => togglePaid(record)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                            record.status === "paid"
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-red-100 text-red-700 hover:bg-red-200"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${record.status === "paid" ? "bg-green-500" : "bg-red-500"}`}></span>
                          {record.status === "paid" ? "Paid" : "Unpaid"}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => deleteDebit(record)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
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
      )}
    </div>
  );
}