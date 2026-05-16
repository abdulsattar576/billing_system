"use client";

import React, { useState, useEffect } from "react";
import { initDB } from "../services/db";

interface Area {
  _id: string;
  name: string;
  type?: string;
  createdAt?: string;
}

export default function DefaulterListsPage() {
  const [db, setDb] = useState<any>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedArea, setSelectedArea] = useState<string>("");
  const [defaulters, setDefaulters] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const setupDB = async () => {
      const pouch = await initDB();
      if (pouch) {
        pouch.syncDB();
        setDb(pouch);
        const allAreas = await pouch.getAreas();
        setAreas(allAreas as unknown as Area[]);
      }
    };
    setupDB();
  }, []);

  const loadDefaulters = async () => {
    if (!db || !selectedArea) return;
    setLoading(true);
    const allDefaulters = await db.getDefaulterPersons(selectedArea);
    setDefaulters(allDefaulters);
    setLoading(false);
  };

  useEffect(() => {
    loadDefaulters();
  }, [selectedArea, db]);

  const deleteDefaulter = async (person: any) => {
    if (!db) return;

    if (!confirm(`Are you sure you want to PERMANENTLY DELETE ${person.name} (Conn #${person.connectionNumber || 'unknown'})? This will remove all their records and cannot be undone.`)) {
      return;
    }

    try {
      const result = await db.deletePerson(person);
      const updatedDefaulters = await db.getDefaulterPersons(selectedArea);
      setDefaulters(updatedDefaulters);
      alert(`Defaulter permanently deleted. (${result.deletedDebits || 0} payment records removed)`);
    } catch (err: any) {
      console.error("Delete failed:", err);
      alert("Failed to delete defaulter: " + (err?.message || "Unknown error"));
    }
  };

  const printDefaulters = () => {
    const printWindow = window.open('', '', 'width=1200,height=600');
    if (!printWindow) return;

    const tableRows = defaulters.map((d) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${d.receiptNo || '-'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${d.connectionNumber || '-'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${d.name}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${d.address || '-'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">Rs.${Number(d.amount || 0).toFixed(2)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">${d.movedToDefaulterAt ? new Date(d.movedToDefaulterAt).toLocaleDateString('en-GB') : '-'}</td>
        <td style="padding:8px;border-bottom:1px solid #eee">Rs.${Number(d.remainingBalance || 0).toFixed(2)}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Defaulter Lists</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .urdu-header { text-align: center; margin-bottom: 20px; direction: rtl; }
          .urdu-header h2 { margin: 0; color: #333; font-size: 24px; font-weight: bold; }
          h1 { text-align:center; }
          table { width:100%; border-collapse: collapse; margin-top: 20px; }
          th { text-align:left; padding:10px; border-bottom:2px solid #ddd; background-color: #f4f4f4; }
        </style>
      </head>
      <body>
        <div class="urdu-header">
          <h2>فیملی کیبل نیٹ ورک</h2>
        </div>
        <h1>Defaulter Lists</h1>
        <p>Area: ${areas.find(a => a._id === selectedArea)?.name || selectedArea}</p>
        <table>
          <thead>
            <tr>
              <th>Receipt No</th>
              <th>Conn #</th>
              <th>Name</th>
              <th>Address</th>
              <th>Monthly Fee</th>
              <th>Disconnection Date</th>
              <th>Pending Dues</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </body>
      </html>
    `);

    printWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Defaulter Lists</h1>
        <p className="text-gray-600">Manage persons who have been moved to the defaulter list</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Select Area</h2>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Area</label>
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
            >
              <option value="">-- Select Area --</option>
              {areas.map((area) => (
                <option key={area._id} value={area._id}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center">
            <button
              onClick={printDefaulters}
              disabled={defaulters.length === 0}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-700 text-white rounded-lg hover:from-blue-700 hover:to-purple-800 transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Print
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading defaulters...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Defaulters</h2>
            <span className="text-sm font-medium text-red-600">Total: {defaulters.length}</span>
          </div>

          {defaulters.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-gray-400 text-lg mb-2">No defaulters in this area</div>
              <p className="text-gray-500">All persons are active</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-red-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">Receipt No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">Conn #</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">Person Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">Address</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">Monthly Fee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">Disconnection Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">Pending Dues</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {defaulters.map((person) => (
                    <tr key={person._id} className="hover:bg-red-50 transition-colors duration-150 bg-yellow-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-blue-700">{person.receiptNo ?? '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{person.connectionNumber ?? '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{person.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {person.address && person.address !== '-' ? person.address : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {person.amount ? `Rs.${Number(person.amount).toFixed(2)}` : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 font-medium">
                          {person.movedToDefaulterAt ? new Date(person.movedToDefaulterAt).toLocaleDateString('en-GB') : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-red-600">
                          Rs.{Number(person.remainingBalance || 0).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => deleteDefaulter(person)}
                          className="text-red-600 hover:text-red-900 hover:bg-red-50 px-3 py-1 rounded-md transition-colors duration-200 font-semibold"
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Defaulters</p>
              <p className="text-2xl font-bold text-red-900 mt-2">{defaulters.length}</p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-red-100 text-red-800">
              ⚠️
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-4">Persons in defaulter list</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Pending Dues</p>
              <p className="text-2xl font-bold text-red-600 mt-2">
                Rs.{defaulters.reduce((sum: number, d: any) => sum + Number(d.remainingBalance || 0), 0).toFixed(2)}
              </p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-red-100 text-red-800">
              💰
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-4">Total unpaid amount</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600">Selected Area</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {selectedArea ? areas.find(a => a._id === selectedArea)?.name : 'None'}
              </p>
            </div>
            <span className={`text-xs font-semibold px-2 py-1 rounded ${
              selectedArea ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {selectedArea ? '✓' : '✗'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            {selectedArea ? 'Area selected' : 'No area selected'}
          </p>
        </div>
      </div>
    </div>
  );
}