"use client";

import React, { useEffect, useState } from "react";
import { initDB } from "../services/db";

export default function RemovePersonPage() {
  const [db, setDb] = useState<any>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const [selectedArea, setSelectedArea] = useState("");
  const [persons, setPersons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const setupDB = async () => {
      const pouch = await initDB();
      if (pouch) {
        pouch.syncDB();
        setDb(pouch);
        const allAreas = await pouch.getAreas();
        setAreas(allAreas);
        setLoading(false);
      }
    };
    setupDB();
  }, []);

  const loadPersons = async (areaId: string) => {
    if (!db) return;
    setSelectedArea(areaId);
    const allPersons = await db.getPersonsByArea(areaId);
    setPersons(allPersons);
  };

  const deletePerson = async (person: any) => {
    if (!db) return;

    if (!confirm(`Are you sure you want to delete ${person.name} (Conn #${person.connectionNumber || 'unknown'})?\nThis will also remove all their payment history.`)) {
      return;
    }

    try {
      const result = await db.deletePerson(person);
      const updatedPersons = await db.getPersonsByArea(selectedArea);
      setPersons(updatedPersons);

      alert(`Person deleted successfully. (${result.deletedDebits || 0} payment records removed)`);
    } catch (err: any) {
      console.error("Delete failed:", err);
      alert("Failed to delete person: " + (err?.message || "Unknown error"));
    }
  };

  const printPersonsList = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      alert('Please allow pop-ups to print the persons list');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Persons List - Remove</title>
        <style>
          body { font-family: 'Arial', sans-serif; margin: 0; padding: 20px; background-color: #fff; }
          .urdu-header { text-align: center; margin-bottom: 15px; direction: rtl; }
          .urdu-header h2 { margin: 0; color: #333; font-size: 24px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f4f4f4; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="urdu-header">
          <h2>فیملی کیبل نیٹ ورک</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Conn #</th>
              <th>Person Name</th>
              <th>Address</th>
              <th>Monthly Fee</th>
              <th>Pending Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${persons.map(person => `
              <tr>
                <td>${person.connectionNumber ?? '-'}</td>
                <td>${person.name}</td>
                <td>${person.address && person.address !== '-' ? person.address : '-'}</td>
                <td>Rs.${person.amount !== undefined ? Number(person.amount).toFixed(2) : '0.00'}</td>
                <td style="color: ${Number(person.remainingBalance || 0) > 0 ? '#dc2626' : '#6b7280'}; font-weight: bold;">
                  Rs.${Number(person.remainingBalance || 0).toFixed(2)}
                </td>
                <td>Active</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 1000);
          };
        </script>
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
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Remove Person</h1>
        <p className="text-gray-600">Select area and delete persons</p>
      </div>

      {/* Area Selection Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Select Area</h2>
        <div className="flex gap-4 items-center">
          <select
            value={selectedArea}
            onChange={(e) => loadPersons(e.target.value)}
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

      {/* Persons List Card - Only show when area is selected */}
      {selectedArea && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">Persons in Selected Area</h2>
            <p className="text-sm text-gray-500 mt-1">{persons.length} person(s) found</p>
          </div>

          {persons.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-gray-400 text-lg mb-2">No persons found in this area</div>
              <p className="text-gray-500">No persons to remove</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Conn #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Person Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Monthly Fee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pending Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {persons.map((person) => (
                    <tr key={person._id} className="hover:bg-gray-50 transition-colors duration-150">
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
                        <div className={`text-sm font-medium ${Number(person.remainingBalance || 0) > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                          Rs.{Number(person.remainingBalance || 0).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button 
                          onClick={() => deletePerson(person)}
                          className="text-red-600 hover:text-red-900 hover:bg-red-50 px-3 py-1 rounded-md transition-colors duration-200"
                        >
                          Delete Person
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

      {/* Print Button for Persons List */}
      {selectedArea && persons.length > 0 && (
        <div className="mt-4">
          <button
            onClick={printPersonsList}
            className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-700 text-white rounded-lg hover:from-green-700 hover:to-emerald-800 transition-colors duration-200 font-medium"
          >
            Print List
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Persons</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{persons.length}</p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-100 text-blue-800">
              +0%
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-4">All persons in selected area</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Areas</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{areas.length}</p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-green-100 text-green-800">
              {areas.length > 0 ? 'Ready' : 'None'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-4">Total areas available</p>
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

      {/* Print Button for Persons List */}
      {selectedArea && persons.length > 0 && (
        <div className="mt-4">
          <button
            onClick={printPersonsList}
            className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-700 text-white rounded-lg hover:from-green-700 hover:to-emerald-800 transition-colors duration-200 font-medium"
          >
            Print List
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Persons</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{persons.length}</p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-100 text-blue-800">
              +0%
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-4">All persons in selected area</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Areas</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{areas.length}</p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-green-100 text-green-800">
              {areas.length > 0 ? 'Ready' : 'None'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-4">Total areas available</p>
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