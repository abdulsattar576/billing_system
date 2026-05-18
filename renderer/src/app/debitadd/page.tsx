// /app/DebitAddPage
"use client";
import { useEffect, useRef, useState } from "react";
import { initDB } from "../services/db";

export default function DebitAddPage() {
  const [db, setDb] = useState<any>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const [personsInArea, setPersonsInArea] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedAreaId, setSelectedAreaId] = useState("");
  const [connQuery, setConnQuery] = useState("");
  const [connSuggestions, setConnSuggestions] = useState<any[]>([]);
  const [showConnDropdown, setShowConnDropdown] = useState(false);

  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [personName, setPersonName] = useState("");
  const [personAddress, setPersonAddress] = useState("");
  const [receiptNo, setReceiptNo] = useState("");

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState<number | "">("");
  const [description, setDescription] = useState("");

  const [debitRecords, setDebitRecords] = useState<any[]>([]);
  const [loadingDebits, setLoadingDebits] = useState(false);

  const connRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const connWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const setup = async () => {
      const pouch = await initDB();
      if (!pouch) return;
      setDb(pouch);
      try {
        const a = await pouch.getAreas();
        setAreas(a || []);
      } catch (e) {
        console.warn(e);
      }
      setLoading(false);
    };
    setup();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        connWrapRef.current &&
        !connWrapRef.current.contains(e.target as Node)
      )
        setShowConnDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const onAreaChange = async (areaId: string) => {
    setSelectedAreaId(areaId);
    setConnQuery("");
    setSelectedPersonId("");
    setPersonName("");
    setPersonAddress("");
    setReceiptNo("");
    setDebitRecords([]);
    setConnSuggestions([]);
    setShowConnDropdown(false);
    if (!db || !areaId) {
      setPersonsInArea([]);
      return;
    }
    try {
      const persons = await db.getPersonsByArea(areaId);
      setPersonsInArea(persons || []);
    } catch (e) {
      console.warn(e);
    }
  };

  const onConnQueryChange = (q: string) => {
    setConnQuery(q);
    setSelectedPersonId("");
    setPersonName("");
    setPersonAddress("");
    setReceiptNo("");
    const qLower = q.toLowerCase();
    const filtered = q.trim()
      ? personsInArea.filter(
          (p) =>
            String(p.connectionNumber ?? "")
              .toLowerCase()
              .includes(qLower) ||
            String(p.name ?? "")
              .toLowerCase()
              .includes(qLower),
        )
      : personsInArea;
    setConnSuggestions(filtered);
    setShowConnDropdown(true);
  };

  const onPersonSelect = async (person: any) => {
    setSelectedPersonId(person._id);
    setPersonName(person.name || "");
    setPersonAddress(person.address || "");
    setReceiptNo(person.receiptNo || "");
    setConnQuery(String(person.connectionNumber ?? ""));
    setConnSuggestions([]);
    setShowConnDropdown(false);
    await loadPersonDebits(person._id);
    setTimeout(() => dateRef.current?.focus(), 100);
  };

  const loadPersonDebits = async (personId: string) => {
    if (!db) return;
    setLoadingDebits(true);
    try {
      const res = await db.localDB.allDocs({ include_docs: true });
      const debits = res.rows
        .map((r: any) => r.doc)
        .filter(
          (d: any) =>
            d &&
            !d._deleted &&
            d.type === "customer-debit" &&
            d.personId === personId,
        )
        .sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      setDebitRecords(debits);
    } catch (e) {
      console.warn(e);
    }
    setLoadingDebits(false);
  };

  const handleSubmit = async () => {
    if (!selectedAreaId) {
      alert("Please select an area");
      return;
    }
    if (!selectedPersonId) {
      alert("Please select a connection number");
      return;
    }
    if (!date) {
      alert("Please select a date");
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
    setSubmitting(true);
    try {
      await db.localDB.put({
        _id: `customer_debit_${selectedAreaId}_${selectedPersonId}_${Date.now()}`,
        type: "customer-debit",
        areaId: selectedAreaId,
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
      });
      await loadPersonDebits(selectedPersonId);
      setAmount("");
      setDescription("");
      setDate(new Date().toISOString().slice(0, 10));
      alert("Debit entry saved!");
    } catch (e: any) {
      alert("Failed to save: " + (e?.message || "Unknown error"));
    }
    setSubmitting(false);
  };

  const deleteDebit = async (record: any) => {
    if (
      !confirm(`Delete debit of Rs.${record.amount} — "${record.description}"?`)
    )
      return;
    try {
      await db.localDB.remove(record);
      await loadPersonDebits(selectedPersonId);
    } catch (e: any) {
      alert("Failed to delete: " + (e?.message || ""));
    }
  };

  const togglePaid = async (record: any) => {
    try {
      await db.localDB.put({
        ...record,
        status: record.status === "paid" ? "unpaid" : "paid",
        updatedAt: new Date().toISOString(),
      });
      await loadPersonDebits(selectedPersonId);
    } catch (e: any) {
      alert("Failed to update: " + (e?.message || ""));
    }
  };

  const printDebits = () => {
    const win = window.open("", "_blank", "width=900,height=600");
    if (!win) return;
    const totalUnpaid = debitRecords
      .filter((r) => r.status !== "paid")
      .reduce((s, r) => s + Number(r.amount || 0), 0);
    const areaName = areas.find((a) => a._id === selectedAreaId)?.name || "";
    win.document
      .write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Debit — ${personName}</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.urdu{text-align:center;direction:rtl;font-size:22px;font-weight:bold;margin-bottom:6px}.sub{text-align:center;font-size:13px;color:#555;margin-bottom:20px}table{width:100%;border-collapse:collapse}th{background:#f3f4f6;padding:9px 10px;text-align:left;font-size:11px;border-bottom:2px solid #ddd}td{padding:8px 10px;border-bottom:1px solid #eee;font-size:13px}.unpaid{color:#dc2626;font-weight:bold}.paid{color:#16a34a}.total{text-align:right;margin-top:14px;font-weight:bold;font-size:15px;color:#dc2626}</style>
      </head><body>
      <div class="urdu">فیملی کیبل نیٹ ورک</div>
      <div class="sub"><strong>Area:</strong> ${areaName} &nbsp;|&nbsp; <strong>Customer:</strong> ${personName} &nbsp;|&nbsp; <strong>Conn #:</strong> ${connQuery} &nbsp;|&nbsp; <strong>Address:</strong> ${personAddress}</div>
      <table><thead><tr><th>#</th><th>Date</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead><tbody>
      ${debitRecords.map((r, i) => `<tr><td>${i + 1}</td><td>${r.date || "-"}</td><td>${r.description}</td><td>Rs.${Number(r.amount).toFixed(2)}</td><td class="${r.status === "paid" ? "paid" : "unpaid"}">${r.status === "paid" ? "Paid" : "Unpaid"}</td></tr>`).join("")}
      </tbody></table>
      <div class="total">Total Unpaid: Rs.${totalUnpaid.toFixed(2)}</div>
      <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1000)}</script></body></html>`);
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
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-3 h-8 bg-gradient-to-b from-red-500 to-rose-600 rounded-full" />
          <h1 className="text-3xl font-bold text-gray-800">
            Customer Debit / Purchase Entry
          </h1>
        </div>
        <p className="text-gray-500 text-sm ml-6">
          Record items purchased by customer on credit
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-7 mb-8">
        <div className="h-1 w-full bg-gradient-to-r from-red-400 to-rose-500 rounded-full mb-6" />
        <h2 className="text-lg font-semibold text-gray-700 mb-6">
          Bill Details
        </h2>

        {/* Row 1: Area + Connection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Area <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedAreaId}
              onChange={(e) => onAreaChange(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-400 focus:border-transparent text-gray-800 bg-white"
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
              Connection # <span className="text-red-500">*</span>
            </label>
            <div className="relative" ref={connWrapRef}>
              <input
                ref={connRef}
                type="text"
                value={connQuery}
                onChange={(e) => onConnQueryChange(e.target.value)}
                onFocus={() => {
                  if (selectedAreaId) {
                    setConnSuggestions(personsInArea);
                    setShowConnDropdown(true);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && connSuggestions.length > 0) {
                    e.preventDefault();
                    onPersonSelect(connSuggestions[0]);
                  }
                  if (e.key === "Escape") setShowConnDropdown(false);
                }}
                placeholder={
                  selectedAreaId
                    ? "Type conn # or name..."
                    : "Select area first"
                }
                disabled={!selectedAreaId}
                className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-400 focus:border-transparent text-gray-800 placeholder-gray-400 disabled:bg-gray-50 disabled:text-gray-400"
              />
              {selectedAreaId && (
                <button
                  type="button"
                  onClick={() => {
                    setConnSuggestions(personsInArea);
                    setShowConnDropdown((v) => !v);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              )}
              {showConnDropdown && (
                <ul className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl max-h-60 overflow-auto shadow-2xl">
                  {connSuggestions.length === 0 ? (
                    <li className="px-4 py-3 text-sm text-gray-400">
                      No matching persons found
                    </li>
                  ) : (
                    connSuggestions.map((p) => (
                      <li
                        key={p._id}
                        onMouseDown={() => onPersonSelect(p)}
                        className="px-4 py-3 hover:bg-red-50 cursor-pointer border-b border-gray-50 last:border-0 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-800">
                            Conn #{p.connectionNumber ?? "-"} — {p.name}
                          </span>
                          {p.receiptNo && (
                            <span className="text-xs text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full font-medium">
                              #{p.receiptNo}
                            </span>
                          )}
                        </div>
                        {p.address && p.address !== "-" && (
                          <div className="text-xs text-gray-400 mt-0.5 truncate">
                            {p.address}
                          </div>
                        )}
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Auto-filled fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {[
            { label: "Customer Name", value: personName },
            { label: "Address", value: personAddress },
            { label: "Receipt No", value: receiptNo },
          ].map(({ label, value }) => (
            <div key={label}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {label}
              </label>
              <input
                type="text"
                value={value}
                readOnly
                placeholder="Auto-filled from connection"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-red-50 text-gray-700 placeholder-gray-400 cursor-default"
              />
            </div>
          ))}
        </div>

        {/* Row 3: Date, Amount, Description */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              ref={dateRef}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  amountRef.current?.focus();
                }
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-400 focus:border-transparent text-gray-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount (Rs.) <span className="text-red-500">*</span>
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
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-400 focus:border-transparent text-gray-800 placeholder-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description / Item <span className="text-red-500">*</span>
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
              placeholder="e.g. Cable wire 50m, Connector box..."
              rows={1}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-400 focus:border-transparent text-gray-800 placeholder-gray-400 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-4 items-center flex-wrap">
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedPersonId}
            className="px-8 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl hover:from-red-600 hover:to-rose-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {submitting ? "Saving..." : "Save Debit Entry"}
          </button>
          {selectedPersonId && debitRecords.length > 0 && (
            <button
              onClick={printDebits}
              className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-700 text-white rounded-xl hover:from-green-700 hover:to-emerald-800 transition-all font-semibold shadow-sm"
            >
              Print Statement
            </button>
          )}
          {selectedPersonId && (
            <div className="flex items-center gap-2 ml-auto px-4 py-2 bg-red-50 border border-red-200 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-sm text-red-700 font-medium">
                {personName}
              </span>
              <span className="text-xs text-red-400">Conn #{connQuery}</span>
            </div>
          )}
        </div>
      </div>

      {/* Debit History */}
      {selectedPersonId && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-7 py-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                Debit History — {personName}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Conn #{connQuery} · {personAddress} · Receipt #{receiptNo}
              </p>
            </div>
            <div className="flex gap-3">
              <div className="px-4 py-2 bg-gray-50 rounded-xl border border-gray-200 text-center">
                <div className="text-xs text-gray-400">Total Billed</div>
                <div className="text-sm font-bold text-gray-800">
                  Rs.{totalAll.toFixed(2)}
                </div>
              </div>
              <div className="px-4 py-2 bg-red-50 rounded-xl border border-red-100 text-center">
                <div className="text-xs text-red-400">Unpaid</div>
                <div className="text-sm font-bold text-red-600">
                  Rs.{totalUnpaid.toFixed(2)}
                </div>
              </div>
              <div className="px-4 py-2 bg-green-50 rounded-xl border border-green-100 text-center">
                <div className="text-xs text-green-500">Paid</div>
                <div className="text-sm font-bold text-green-700">
                  Rs.{(totalAll - totalUnpaid).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {loadingDebits ? (
            <div className="p-10 text-center text-gray-400">
              Loading records...
            </div>
          ) : debitRecords.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-gray-300 text-4xl mb-3">📋</div>
              <div className="text-gray-400 text-sm">
                No debit records yet for this customer
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {[
                      "#",
                      "Date",
                      "Description / Item",
                      "Amount",
                      "Status",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                      >
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
                      <td className="px-6 py-4 text-sm text-gray-400 font-mono">
                        {idx + 1}
                      </td>
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
                          Added{" "}
                          {new Date(record.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`text-sm font-bold ${record.status === "paid" ? "text-gray-500 line-through" : "text-red-600"}`}
                        >
                          Rs.{Number(record.amount).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => togglePaid(record)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${record.status === "paid" ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-700 hover:bg-red-200"}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${record.status === "paid" ? "bg-green-500" : "bg-red-500"}`}
                          />
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
