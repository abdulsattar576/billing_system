// /spp/CreditNotePage
"use client";
import { useEffect, useRef, useState } from "react";
import { initDB } from "../services/db";

export default function CreditNotePage() {
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
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

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
    setCreditNotes([]);
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
    setDebitRecords([]);
    setCreditNotes([]);
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
    await loadPersonRecords(person._id);
    setTimeout(() => dateRef.current?.focus(), 100);
  };

  const loadPersonRecords = async (personId: string) => {
    if (!db) return;
    setLoadingRecords(true);
    try {
      const res = await db.localDB.allDocs({ include_docs: true });
      const docs = res.rows
        .map((r: any) => r.doc)
        .filter((d: any) => d && !d._deleted);

      const debits = docs
        .filter(
          (d: any) => d.type === "customer-debit" && d.personId === personId,
        )
        .sort(
          (a: any, b: any) =>
            new Date(a.date).getTime() - new Date(b.date).getTime(),
        );

      const credits = docs
        .filter((d: any) => d.type === "credit-note" && d.personId === personId)
        .sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );

      setDebitRecords(debits);
      setCreditNotes(credits);
    } catch (e) {
      console.warn(e);
    }
    setLoadingRecords(false);
  };

  // FIFO credit distribution
  const getEffectiveDebitRows = () => {
    let remaining = creditNotes.reduce((s, c) => s + Number(c.amount || 0), 0);
    return debitRecords.map((d) => {
      const original = Number(d.amount || 0);
      const credited = Math.min(remaining, original);
      remaining = Math.max(0, remaining - original);
      return {
        ...d,
        originalAmount: original,
        creditedAmount: credited,
        effectiveAmount: Math.max(0, original - credited),
      };
    });
  };

  const effectiveRows = getEffectiveDebitRows();
  const totalDebit = debitRecords.reduce(
    (s, r) => s + Number(r.amount || 0),
    0,
  );
  const totalCredited = creditNotes.reduce(
    (s, c) => s + Number(c.amount || 0),
    0,
  );
  const netBalance = Math.max(0, totalDebit - totalCredited);

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
      alert("Please enter a valid credit amount");
      return;
    }
    if (!description.trim()) {
      alert("Please enter a reason / description");
      return;
    }

    if (Number(amount) > netBalance) {
      if (
        !confirm(
          `Credit amount Rs.${Number(amount).toFixed(2)} exceeds net balance Rs.${netBalance.toFixed(2)}. Continue anyway?`,
        )
      )
        return;
    }

    setSubmitting(true);
    try {
      await db.localDB.put({
        _id: `credit_note_${selectedAreaId}_${selectedPersonId}_${Date.now()}`,
        type: "credit-note",
        areaId: selectedAreaId,
        personId: selectedPersonId,
        connectionNumber: connQuery,
        personName,
        personAddress,
        receiptNo,
        date,
        amount: Number(amount),
        description: description.trim(),
        createdAt: new Date().toISOString(),
      });
      await loadPersonRecords(selectedPersonId);
      setAmount("");
      setDescription("");
      setDate(new Date().toISOString().slice(0, 10));
      alert("Credit note saved!");
    } catch (e: any) {
      alert("Failed to save: " + (e?.message || ""));
    }
    setSubmitting(false);
  };

  const deleteCredit = async (record: any) => {
    if (
      !confirm(
        `Delete credit note of Rs.${record.amount} — "${record.description}"?`,
      )
    )
      return;
    try {
      await db.localDB.remove(record);
      await loadPersonRecords(selectedPersonId);
    } catch (e: any) {
      alert("Failed to delete: " + (e?.message || ""));
    }
  };

  const printStatement = () => {
    const win = window.open("", "_blank", "width=900,height=650");
    if (!win) return;
    const areaName = areas.find((a) => a._id === selectedAreaId)?.name || "";
    win.document
      .write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Credit Note — ${personName}</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.urdu{text-align:center;direction:rtl;font-size:22px;font-weight:bold;margin-bottom:6px}.sub{text-align:center;font-size:13px;color:#555;margin-bottom:20px}h3{margin:20px 0 8px;font-size:14px;color:#374151;border-bottom:1px solid #e5e7eb;padding-bottom:4px}table{width:100%;border-collapse:collapse;margin-bottom:16px}th{background:#f9fafb;padding:9px 10px;text-align:left;font-size:11px;border-bottom:2px solid #e5e7eb}td{padding:8px 10px;border-bottom:1px solid #f3f4f6;font-size:12px}.credit{color:#16a34a;font-weight:bold}.strike{text-decoration:line-through;color:#9ca3af}.summary{display:flex;gap:24px;margin-bottom:16px}.pill{border:1px solid #e5e7eb;border-radius:8px;padding:8px 16px;text-align:center}.pill .label{font-size:10px;color:#6b7280}.pill .val{font-size:14px;font-weight:bold}.net{text-align:right;font-weight:bold;font-size:15px;margin-top:10px;color:#1d4ed8}</style>
      </head><body>
      <div class="urdu">فیملی کیبل نیٹ ورک</div>
      <div class="sub"><strong>Area:</strong> ${areaName} &nbsp;|&nbsp; <strong>Customer:</strong> ${personName} &nbsp;|&nbsp; <strong>Conn #:</strong> ${connQuery} &nbsp;|&nbsp; <strong>Address:</strong> ${personAddress}</div>
      <div class="summary">
        <div class="pill"><div class="label">Total Debit</div><div class="val">Rs.${totalDebit.toFixed(2)}</div></div>
        <div class="pill"><div class="label">Total Credited</div><div class="val" style="color:#16a34a">Rs.${totalCredited.toFixed(2)}</div></div>
        <div class="pill"><div class="label">Net Balance</div><div class="val" style="color:#1d4ed8">Rs.${netBalance.toFixed(2)}</div></div>
      </div>
      <h3>Debit Records (after credit applied)</h3>
      <table><thead><tr><th>#</th><th>Date</th><th>Description</th><th>Original</th><th>Credited</th><th>Net Due</th></tr></thead><tbody>
      ${effectiveRows.map((r, i) => `<tr><td>${i + 1}</td><td>${r.date || "-"}</td><td>${r.description}</td><td>${r.creditedAmount > 0 ? `<span class="strike">Rs.${r.originalAmount.toFixed(2)}</span>` : `Rs.${r.originalAmount.toFixed(2)}`}</td><td class="credit">${r.creditedAmount > 0 ? `Rs.${r.creditedAmount.toFixed(2)}` : "-"}</td><td style="font-weight:bold;color:${r.effectiveAmount > 0 ? "#dc2626" : "#16a34a"}">Rs.${r.effectiveAmount.toFixed(2)}</td></tr>`).join("")}
      </tbody></table>
      <h3>Credit Notes Issued</h3>
      <table><thead><tr><th>#</th><th>Date</th><th>Reason</th><th>Amount</th></tr></thead><tbody>
      ${creditNotes.map((c, i) => `<tr><td>${i + 1}</td><td>${c.date || "-"}</td><td>${c.description}</td><td class="credit">Rs.${Number(c.amount).toFixed(2)}</td></tr>`).join("")}
      </tbody></table>
      <div class="net">Net Balance Due: Rs.${netBalance.toFixed(2)}</div>
      <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),1000)}</script></body></html>`);
    win.document.close();
  };

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
          <div className="w-3 h-8 bg-gradient-to-b from-green-500 to-emerald-600 rounded-full" />
          <h1 className="text-3xl font-bold text-gray-800">
            Credit Note / Concession
          </h1>
        </div>
        <p className="text-gray-500 text-sm ml-6">
          Issue a concession that reduces the customer's outstanding debit
          balance
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-7 mb-8">
        <div className="h-1 w-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full mb-6" />
        <h2 className="text-lg font-semibold text-gray-700 mb-6">
          Issue Credit Note
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
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-800 bg-white"
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
                className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-800 placeholder-gray-400 disabled:bg-gray-50 disabled:text-gray-400"
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
                        className="px-4 py-3 hover:bg-green-50 cursor-pointer border-b border-gray-50 last:border-0 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-800">
                            Conn #{p.connectionNumber ?? "-"} — {p.name}
                          </span>
                          {p.receiptNo && (
                            <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">
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

        {/* Row 2: Auto-filled */}
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
                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-green-50 text-gray-700 placeholder-gray-400 cursor-default"
              />
            </div>
          ))}
        </div>

        {/* Balance indicator */}
        {selectedPersonId && (
          <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-0.5">Total Debit</div>
              <div className="text-base font-bold text-red-600">
                Rs.{totalDebit.toFixed(2)}
              </div>
            </div>
            <div className="flex items-center text-gray-300 text-xl">−</div>
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-0.5">
                Already Credited
              </div>
              <div className="text-base font-bold text-green-600">
                Rs.{totalCredited.toFixed(2)}
              </div>
            </div>
            <div className="flex items-center text-gray-300 text-xl">=</div>
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-0.5">Net Balance</div>
              <div
                className={`text-base font-bold ${netBalance > 0 ? "text-blue-700" : "text-green-600"}`}
              >
                Rs.{netBalance.toFixed(2)}
              </div>
            </div>
            {Number(amount) > 0 && (
              <>
                <div className="flex items-center text-gray-300 text-xl">→</div>
                <div className="text-center">
                  <div className="text-xs text-gray-400 mb-0.5">
                    After This Credit
                  </div>
                  <div className="text-base font-bold text-indigo-700">
                    Rs.{Math.max(0, netBalance - Number(amount)).toFixed(2)}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

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
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Credit Amount (Rs.) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
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
                className="w-full px-4 py-3 border border-green-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-800 placeholder-gray-400"
              />
              {Number(amount) > 0 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-600 font-semibold bg-green-50 px-2 py-0.5 rounded-full">
                  − Rs.{Number(amount).toFixed(2)}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason / Description <span className="text-red-500">*</span>
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
              placeholder="e.g. Damaged cable concession, loyalty discount..."
              rows={1}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-800 placeholder-gray-400 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-4 items-center flex-wrap">
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedPersonId}
            className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-700 text-white rounded-xl hover:from-green-700 hover:to-emerald-800 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {submitting ? "Saving..." : "Issue Credit Note"}
          </button>
          {selectedPersonId &&
            (debitRecords.length > 0 || creditNotes.length > 0) && (
              <button
                onClick={printStatement}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl hover:from-blue-700 hover:to-indigo-800 transition-all font-semibold shadow-sm"
              >
                Print Statement
              </button>
            )}
          {selectedPersonId && (
            <div className="flex items-center gap-2 ml-auto px-4 py-2 bg-green-50 border border-green-200 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-green-700 font-medium">
                {personName}
              </span>
              <span className="text-xs text-green-500">Conn #{connQuery}</span>
            </div>
          )}
        </div>
      </div>

      {/* Records section */}
      {selectedPersonId && (
        <div className="grid grid-cols-1   gap-6">
          {/* Left: Debits with credit applied */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-red-50">
              <h2 className="text-base font-semibold text-gray-800">
                Customer Debits
                <span className="ml-2 text-xs font-normal text-gray-500">
                  (credit applied oldest first)
                </span>
              </h2>
            </div>
            {loadingRecords ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                Loading...
              </div>
            ) : effectiveRows.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                No debit records for this customer
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      {[
                        "Date",
                        "Description",
                        "Original",
                        "Credited",
                        "Net Due",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {effectiveRows.map((row) => (
                      <tr
                        key={row._id}
                        className={`hover:bg-gray-50 transition-colors ${row.effectiveAmount === 0 ? "opacity-50" : ""}`}
                      >
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {row.date
                            ? new Date(row.date).toLocaleDateString("en-PK", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "-"}
                        </td>
                        <td
                          className="px-4 py-3 text-sm text-gray-800 max-w-[160px] truncate"
                          title={row.description}
                        >
                          {row.description}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          {row.creditedAmount > 0 ? (
                            <span className="line-through text-gray-400">
                              Rs.{row.originalAmount.toFixed(2)}
                            </span>
                          ) : (
                            <span>Rs.{row.originalAmount.toFixed(2)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          {row.creditedAmount > 0 ? (
                            <span className="text-green-600 font-semibold">
                              − Rs.{row.creditedAmount.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`text-sm font-bold ${row.effectiveAmount === 0 ? "text-green-600" : "text-red-600"}`}
                          >
                            Rs.{row.effectiveAmount.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td
                        colSpan={2}
                        className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase"
                      >
                        Total
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-red-600">
                        Rs.{totalDebit.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-green-600">
                        − Rs.{totalCredited.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-blue-700">
                        Rs.{netBalance.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Right: Credit notes */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-green-50">
              <h2 className="text-base font-semibold text-gray-800">
                Credit Notes Issued
              </h2>
            </div>
            {loadingRecords ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                Loading...
              </div>
            ) : creditNotes.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-gray-300 text-3xl mb-2">🎫</div>
                <div className="text-gray-400 text-sm">No credit notes yet</div>
                <p className="text-gray-300 text-xs mt-1">
                  Issue the first credit note above
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      {[
                        "Date",
                        "Reason / Description",
                        "Amount",
                        "Actions",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {creditNotes.map((cn) => (
                      <tr
                        key={cn._id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {cn.date
                            ? new Date(cn.date).toLocaleDateString("en-PK", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800 max-w-[180px]">
                          <div
                            className="font-medium truncate"
                            title={cn.description}
                          >
                            {cn.description}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            Added {new Date(cn.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-lg">
                            − Rs.{Number(cn.amount).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={() => deleteCredit(cn)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td
                        colSpan={2}
                        className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase"
                      >
                        Total Credited
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-green-600">
                        − Rs.{totalCredited.toFixed(2)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
