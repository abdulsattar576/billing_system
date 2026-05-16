"use client";

import React, { useEffect, useState } from "react";
import { initDB } from "../services/db";

interface Area {
  _id: string;
  name: string;
  type?: string;
  createdAt?: string;
}

export default function DisconnectionListPage() {
  const [db, setDb] = useState<any>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedArea, setSelectedArea] = useState("");
  const [disconnected, setDisconnected] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const setup = async () => {
      const pouch = await initDB();
      if (!pouch) return;
      pouch.syncDB();
      setDb(pouch);
      const allAreas = await pouch.getAreas();
      setAreas(allAreas as unknown as Area[]);
    };
    setup();
  }, []);

  const loadDisconnected = async (areaId: string) => {
    if (!db || !areaId) return;
    setLoading(true);
    const list = await db.getDisconnectedPersons(areaId);
    setDisconnected(list);
    setLoading(false);
  };

  useEffect(() => {
    if (selectedArea && db) loadDisconnected(selectedArea);
  }, [selectedArea, db]);

  const handleReconnect = async (person: any) => {
    if (!db) return;
    if (!confirm(`Reconnect ${person.name} (Conn #${person.connectionNumber || "unknown"})? They will be moved back to active connections.`)) return;
    try {
      await db.reconnectPerson(person);
      await loadDisconnected(selectedArea);
      alert(`${person.name} has been reconnected successfully.`);
    } catch (err: any) {
      alert("Failed to reconnect: " + (err?.message || "Unknown error"));
    }
  };

  const handleDelete = async (person: any) => {
    if (!db) return;
    if (!confirm(`Permanently delete ${person.name} (Conn #${person.connectionNumber || "unknown"}) and all their records? This cannot be undone.`)) return;
    try {
      await db.deletePerson(person);
      await loadDisconnected(selectedArea);
      alert("Person permanently deleted.");
    } catch (err: any) {
      alert("Failed to delete: " + (err?.message || "Unknown error"));
    }
  };

  const filtered = disconnected.filter((p) => {
    if (!searchTerm.trim()) return true;
    const t = searchTerm.toLowerCase();
    return (
      p.name?.toLowerCase().includes(t) ||
      String(p.connectionNumber ?? "").toLowerCase().includes(t) ||
      p.address?.toLowerCase().includes(t) ||
      String(p.receiptNo ?? "").toLowerCase().includes(t)
    );
  });

  const printList = () => {
    const win = window.open("", "_blank", "width=900,height=600");
    if (!win) return;
    const areaName = areas.find((a) => a._id === selectedArea)?.name || "";
    win.document.write(`
      <!DOCTYPE html><html><head><title>Disconnection List</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; }
        .header { text-align:center; margin-bottom:16px; direction:rtl; }
        .header h2 { font-size:22px; color:#333; margin:0; }
        h1 { text-align:center; font-size:18px; margin:8px 0 4px; }
        p.sub { text-align:center; font-size:13px; color:#666; margin:0 0 16px; }
        table { width:100%; border-collapse:collapse; font-size:13px; }
        th { background:#f4f4f4; padding:9px 10px; text-align:left; border-bottom:2px solid #ddd; font-weight:bold; }
        td { padding:8px 10px; border-bottom:1px solid #eee; }
      </style></head><body>
      <div class="header"><h2>فیملی کیبل نیٹ ورک</h2></div>
      <h1>Disconnection List</h1>
      <p class="sub">Area: ${areaName} &nbsp;|&nbsp; Total: ${filtered.length}</p>
      <table>
        <thead><tr>
          <th>Receipt No</th><th>Conn #</th><th>Name</th><th>Address</th>
          <th>Monthly Fee</th><th>Disconnected On</th><th>Balance Due</th>
        </tr></thead>
        <tbody>
          ${filtered.map((p) => `
            <tr>
              <td>${p.receiptNo || "-"}</td>
              <td>${p.connectionNumber || "-"}</td>
              <td>${p.name}</td>
              <td>${p.address && p.address !== "-" ? p.address : "-"}</td>
              <td>Rs.${Number(p.amount || 0).toFixed(2)}</td>
              <td>${p.disconnectedAt ? new Date(p.disconnectedAt).toLocaleDateString("en-GB") : "-"}</td>
              <td>Rs.${Number(p.remainingBalance || 0).toFixed(2)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <script>window.onload=function(){window.print();setTimeout(()=>window.close(),1000);}</script>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-1">Disconnection List</h1>
        <p className="text-gray-500">Manage disconnected connections — reconnect or permanently remove</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Area</label>
            <select
              value={selectedArea}
              onChange={(e) => { setSelectedArea(e.target.value); setSearchTerm(""); }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
            >
              <option value="">-- Select Area --</option>
              {areas.map((a) => (
                <option key={a._id} value={a._id}>{a.name}</option>
              ))}
            </select>
          </div>

          {selectedArea && disconnected.length > 0 && (
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Name, conn #, receipt no, address"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400"
              />
            </div>
          )}

          <button
            onClick={printList}
            disabled={filtered.length === 0}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-700 text-white rounded-lg hover:from-blue-700 hover:to-purple-800 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Print List
          </button>
        </div>
      </div>

      {/* Stats */}
      {selectedArea && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Disconnected</p>
            <p className="text-2xl font-bold text-gray-700">{disconnected.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Total Balance Due</p>
            <p className="text-2xl font-bold text-red-600">
              Rs.{disconnected.reduce((s, p) => s + Number(p.remainingBalance || 0), 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Area</p>
            <p className="text-xl font-bold text-gray-800">{areas.find((a) => a._id === selectedArea)?.name || "-"}</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {!selectedArea ? (
          <div className="p-16 text-center">
            <div className="text-gray-300 text-5xl mb-4">🔌</div>
            <div className="text-gray-500 text-lg mb-1">No area selected</div>
            <p className="text-gray-400 text-sm">Select an area above to view disconnected connections</p>
          </div>
        ) : loading ? (
          <div className="p-12 text-center text-gray-500">Loading...</div>
        ) : disconnected.length === 0 ? (
          <div className="p-16 text-center">
            <div className="text-green-400 text-5xl mb-4">✓</div>
            <div className="text-gray-500 text-lg mb-1">No disconnected connections</div>
            <p className="text-gray-400 text-sm">All connections in this area are active</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No results match your search</div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Disconnected Connections</h2>
                <p className="text-sm text-gray-500 mt-0.5">{filtered.length} connection(s)</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receipt No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conn #</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly Fee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Disconnected On</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance Due</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filtered.map((person) => (
                    <tr key={person._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-blue-700">{person.receiptNo || "-"}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {person.connectionNumber || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {person.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {person.address && person.address !== "-" ? person.address : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        Rs.{Number(person.amount || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                        {person.disconnectedAt
                          ? new Date(person.disconnectedAt).toLocaleDateString("en-GB")
                          : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-semibold ${Number(person.remainingBalance || 0) > 0 ? "text-red-600" : "text-green-600"}`}>
                          Rs.{Number(person.remainingBalance || 0).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex gap-2">
                        <button
                          onClick={() => handleReconnect(person)}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors text-xs font-semibold"
                        >
                          Reconnect
                        </button>
                        <button
                          onClick={() => handleDelete(person)}
                          className="text-red-600 hover:text-red-900 hover:bg-red-50 px-3 py-1 rounded-md transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
