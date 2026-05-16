"use client";

import React, { useEffect, useState } from "react";
import { initDB } from "@/app/services/db";

export default function InternetReportPage() {
  const [db, setDb] = useState<any>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const [areaQuery, setAreaQuery] = useState("");
  const [areaSuggestions, setAreaSuggestions] = useState<any[]>([]);
  const [selectedArea, setSelectedArea] = useState("");

  const [entriesInArea, setEntriesInArea] = useState<any[]>([]);
  const [connectionQuery, setConnectionQuery] = useState("");
  const [connectionSuggestions, setConnectionSuggestions] = useState<any[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState("");
  const [selectedEntryName, setSelectedEntryName] = useState("");
  const [selectedEntryFee, setSelectedEntryFee] = useState<number | null>(null);
  const [selectedEntryInstallationFee, setSelectedEntryInstallationFee] = useState<number | null>(null);
  const [selectedEntryCreatedAt, setSelectedEntryCreatedAt] = useState<string | null>(null);
  const [monthlyBalances, setMonthlyBalances] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [monthTransactions, setMonthTransactions] = useState<any[]>([]);

  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const onAreaSelect = async (areaId: string) => {
    setSelectedArea(areaId);
    setSelectedEntryId("");
    setSelectedEntryName("");
    setRecords([]);
    setConnectionQuery("");
    setConnectionSuggestions([]);
    setSelectedMonth("");
    if (!db || !areaId) return;
    try {
      const e = await db.getInternetEntriesByArea(areaId);
      setEntriesInArea(e || []);
    } catch (err) {
      console.warn("failed to load internet entries for area", err);
    }
  };

  const onEntrySelect = async (entryId: string) => {
    setSelectedEntryId(entryId);
    let entry = entriesInArea.find((x) => x._id === entryId);
    if (!entry && db) {
      try {
        entry = await db.localDB.get(entryId);
      } catch (e) {
        // ignore
      }
    }
    setSelectedEntryName(entry?.name || "");
    setSelectedEntryFee(entry?.monthlyFee ?? null);
    setSelectedEntryInstallationFee(entry?.installationFee ?? null);
    setSelectedEntryCreatedAt(entry?.createdAt ?? null);
    setConnectionSuggestions([]);
    setConnectionQuery(entry ? String(entry.connectionNumber ?? entry.cnic ?? entry.name ?? "") : "");
    setSelectedMonth("");
    await loadRecordsForEntry(entryId, entry?.monthlyFee ?? null);
    setMonthTransactions([]);
  };

  const loadMonthTransactions = async (month: string) => {
    if (!db || !month) {
      setMonthTransactions([]);
      return;
    }

    const toMonth = (dStr?: string) => {
      if (!dStr) return null;
      try {
        const d = new Date(dStr);
        if (Number.isNaN(d.getTime())) return null;
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } catch (e) {
        return null;
      }
    };

    try {
      await db.localDB.createIndex({ index: { fields: ['type', 'areaId', 'personId', 'createdAt', 'month'] } });
      const debRes = await db.localDB.find({ selector: { type: 'debit' } });
      const debits = (debRes.docs || []).filter((d: any) => {
        if (selectedArea && d.areaId && d.areaId !== selectedArea) return false;
        // here debit.personId may reference internet entry id
        if (selectedEntryId && d.personId && d.personId !== selectedEntryId) return false;
        const m = d.month || toMonth(d.createdAt);
        return m === month;
      }).map((d: any) => ({ type: 'payment', doc: d, date: d.createdAt || null }));

      await db.localDB.createIndex({ index: { fields: ['type', 'areaId', 'createdAt', 'updatedAt'] } });
      const entRes = await db.localDB.find({ selector: { type: 'internet-entry' } });
      const entries = (entRes.docs || []).flatMap((p: any) => {
        if (selectedArea && p.areaId && p.areaId !== selectedArea) return [];
        if (selectedEntryId && p._id !== selectedEntryId) return [];

        const rows: any[] = [];
        const mCreated = toMonth(p.createdAt);
        if (mCreated === month) rows.push({ type: 'entry-created', doc: p, date: p.createdAt });
        const mUpdated = toMonth(p.updatedAt);
        if (mUpdated === month) rows.push({ type: 'entry-updated', doc: p, date: p.updatedAt });
        return rows;
      });

      const combined = [...debits, ...entries].sort((a: any, b: any) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const dbt = b.date ? new Date(b.date).getTime() : 0;
        return dbt - da;
      });

      setMonthTransactions(combined);
    } catch (err) {
      console.warn('failed to load month transactions', err);
      setMonthTransactions([]);
    }
  };

  React.useEffect(() => {
    if (!selectedMonth) {
      setMonthTransactions([]);
      return;
    }
    loadMonthTransactions(selectedMonth);
  }, [selectedMonth, db, selectedArea, selectedEntryId]);

  const loadRecordsForEntry = async (entryId: string, expectedFeeOverride: number | null = null) => {
    if (!db || !entryId) return;
    try {
      await db.localDB.createIndex({ index: { fields: ["type", "personId"] } });
      const res = await db.localDB.find({ selector: { type: "debit", personId: entryId } });
      const docs = res.docs || [];
      setRecords(docs);

      const byMonth: Record<string, { paid: number; lastPaidAt?: string }> = {};
      docs.forEach((d: any) => {
        const m = d.month || (d.createdAt ? `${new Date(d.createdAt).getFullYear()}-${String(new Date(d.createdAt).getMonth() + 1).padStart(2, '0')}` : null);
        if (!m) return;
        if (!byMonth[m]) byMonth[m] = { paid: 0, lastPaidAt: d.createdAt };
        byMonth[m].paid += Number(d.amount) || 0;
        if (d.createdAt && (!byMonth[m].lastPaidAt || new Date(d.createdAt) > new Date(byMonth[m].lastPaidAt))) {
          byMonth[m].lastPaidAt = d.createdAt;
        }
      });

      let months: string[] = [];
      if (docs.length > 0) {
        const earliest = docs.reduce((min: any, r: any) => {
          if (!r.createdAt) return min;
          const d = new Date(r.createdAt);
          return !min || d < min ? d : min;
        }, null);
        const start = earliest ? new Date(earliest.getFullYear ? earliest.getFullYear() : new Date(earliest).getFullYear(), earliest.getMonth ? earliest.getMonth() : new Date(earliest).getMonth(), 1) : new Date();
        const now = new Date();
        for (let d = new Date(start); d <= new Date(now.getFullYear(), now.getMonth(), 1); d.setMonth(d.getMonth() + 1)) {
          months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
      } else {
        const now = new Date();
        months = [`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`];
      }

      const expected = Number(expectedFeeOverride ?? selectedEntryFee) || 0;
      let cumulative = 0;
      const mb = months.map((m) => {
        const paid = Number(byMonth[m]?.paid || 0);
        const pending = expected - paid;
        cumulative += pending;
        return {
          month: m,
          expected,
          paid,
          pending,
          cumulativePending: cumulative,
          lastPaidAt: byMonth[m]?.lastPaidAt,
        };
      });

      setMonthlyBalances(mb);
    } catch (e) {
      console.warn("failed to load records for entry", e);
    }
  };

  const toMonth = (dStr?: string | null) => {
    if (!dStr) return null;
    try {
      const d = new Date(dStr);
      if (Number.isNaN(d.getTime())) return null;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    } catch (e) {
      return null;
    }
  };

  const paidInSelectedMonth = selectedMonth
    ? records
        .filter((r: any) => {
          const m = r.month || toMonth(r.createdAt);
          return m === selectedMonth;
        })
        .reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0)
    : 0;

  const expectedPerMonth = Number(selectedEntryFee) || 0;
  const selectedPendingAmount = selectedMonth ? Math.max(0, expectedPerMonth - paidInSelectedMonth) : 0;

  const earliestRecordDate = records.reduce((min: string | null, r: any) => {
    if (!r.createdAt) return min;
    const d = new Date(r.createdAt);
    if (!min) return d.toISOString();
    return new Date(min) > d ? d.toISOString() : min;
  }, null as string | null);

  const startDate = selectedEntryCreatedAt ? new Date(selectedEntryCreatedAt) : earliestRecordDate ? new Date(earliestRecordDate) : null;

  const monthsBetween = (start?: Date | null, end: Date = new Date()) => {
    if (!start) return 1;
    const sy = start.getFullYear();
    const sm = start.getMonth();
    const ey = end.getFullYear();
    const em = end.getMonth();
    return (ey - sy) * 12 + (em - sm) + 1;
  };

  const monthsCount = monthsBetween(startDate, new Date());
  const totalExpectedAllTime = expectedPerMonth * monthsCount;
  const totalPaidAllTime = records.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
  // total charges include expected monthly fees plus any installation fee
  const totalChargesAllTime = totalExpectedAllTime + (Number(selectedEntryInstallationFee || 0));
  const pendingRemainingAllTime = totalChargesAllTime - totalPaidAllTime;

  const printRecords = () => {
    const printWindow = window.open('', '', 'width=1200,height=600');
    if (!printWindow) return;

    const tableRows = monthlyBalances.map((mb) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${mb.month}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">Rs.${Number(mb.expected).toFixed(2)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">Rs.${Number(mb.paid).toFixed(2)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">Rs.${Number(mb.pending).toFixed(2)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">Rs.${Number(mb.cumulativePending).toFixed(2)}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Internet Entries Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { text-align:center; }
          table { width:100%; border-collapse: collapse; margin-top: 20px; }
          th { text-align:left; padding:10px; border-bottom:2px solid #ddd }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <!-- Urdu Header -->
          <div class="urdu-header">
            <h2>فیملی کیبل نیٹ ورک</h2>
          </div>
          
          <!-- Urdu Names Section -->
          <div class="urdu-names">
            <h3>خالد محمود خان</h3>
            <div class="ceo-title">CEO's</div>
            <div class="owner-name">سید محمد رضا شاہ</div>
          </div>

          <!-- Existing content continues here -->
        <h1>Internet Entries Report</h1>
        <p>Area: ${selectedArea ? (areas.find(a => a._id === selectedArea)?.name || selectedArea) : 'All'}</p>
        <p>Entry: ${selectedEntryName || 'All'}</p>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Expected</th>
              <th>Paid</th>
              <th>Pending</th>
              <th>Cumulative Pending</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <h3 style="margin-top:20px">Transactions for ${selectedMonth || 'Selected'}</h3>
        <table style="width:100%;border-collapse:collapse;margin-top:10px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd">Type</th>
              <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd">Details</th>
              <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd">Amount</th>
              <th style="text-align:left;padding:8px;border-bottom:2px solid #ddd">Date</th>
            </tr>
          </thead>
          <tbody>
            ${monthTransactions.map((t: any) => `
              <tr>
                <td style="padding:8px;border-bottom:1px solid #eee">${t.type}</td>
                <td style="padding:8px;border-bottom:1px solid #eee">${t.type === 'payment' ? (t.doc.connectionNumber || t.doc.personName || '-') : (t.doc.name || '-')}</td>
                <td style="padding:8px;border-bottom:1px solid #eee">${t.type === 'payment' ? `Rs.${Number(t.doc.amount).toFixed(2)}` : '-'}</td>
                <td style="padding:8px;border-bottom:1px solid #eee">${t.date ? new Date(t.date).toLocaleString() : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <p style="margin-top:20px">All-time balance: Rs.${Number(pendingRemainingAllTime).toFixed(2)}</p>
      </body>
      </html>
    `);

    printWindow.document.close();
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-lg text-gray-600">Loading Database...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Internet Report Menu</h1>
        <p className="text-gray-600">Monthly balances and transactions for internet entries</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Select Area</h2>
        <div className="flex gap-4 items-center">
          <select
            value={selectedArea}
            onChange={(e) => onAreaSelect(e.target.value)}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
          >
            <option value="">-- Select Area --</option>
            {areas.map((area) => (
              <option key={area._id} value={area._id}>
                {area.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedArea && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Select Internet Entry</h2>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search by Name or Connection #</label>
              <input
                type="text"
                value={connectionQuery}
                onChange={(e) => setConnectionQuery(e.target.value)}
                placeholder="Enter name or connection number..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-500"
                onKeyPress={(e) => e.key === 'Enter' && null}
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Entry</label>
              <select
                value={selectedEntryId}
                onChange={(e) => onEntrySelect(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
              >
                <option value="">-- Select Entry --</option>
                {entriesInArea.map((p) => (
                  <option key={p._id} value={p._id}>{p.name} - {p.connectionNumber || p.cnic || '-'}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
              />
            </div>

            <div className="flex items-center">
              <button
                onClick={printRecords}
                disabled={monthlyBalances.length === 0}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-700 text-white rounded-lg hover:from-blue-700 hover:to-purple-800 transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedEntryId && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Monthly Balances</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expected</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pending</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cumulative Pending</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {monthlyBalances.map((mb) => (
                  <tr key={mb.month} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{mb.month}</div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-500">Rs.{Number(mb.expected).toFixed(2)}</div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-500">Rs.{Number(mb.paid).toFixed(2)}</div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-500">Rs.{Number(mb.pending).toFixed(2)}</div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-500">Rs.{Number(mb.cumulativePending).toFixed(2)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedMonth && monthTransactions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Transactions ({selectedMonth})</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {monthTransactions.map((t, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-900">{t.type}</div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-500">{t.type === 'payment' ? (t.doc.connectionNumber || t.doc.personName || '-') : (t.doc.name || '-')}</div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-500">{t.type === 'payment' ? `Rs.${Number(t.doc.amount).toFixed(2)}` : '-'}</div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-500">{t.date ? new Date(t.date).toLocaleString() : '-'}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending (Selected Month)</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">Rs.{Number(selectedPendingAmount).toFixed(2)}</p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-orange-100 text-orange-800">Pending</span>
          </div>
          <p className="text-xs text-gray-500 mt-4">Amount pending for the chosen month</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600">All-time Balance</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">Rs.{Number(pendingRemainingAllTime).toFixed(2)}</p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-gray-100 text-gray-800">Balance</span>
          </div>
          <p className="text-xs text-gray-500 mt-4">Cumulative pending since start</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600">Selected Entry</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{selectedEntryName || 'None'}</p>
            </div>
            <span className={`text-xs font-semibold px-2 py-1 rounded ${selectedEntryId ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
              {selectedEntryId ? '✓' : '✗'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-4">Monthly fee: Rs.{Number(selectedEntryFee || 0).toFixed(2)} | Installation: Rs.{Number(selectedEntryInstallationFee || 0).toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}
