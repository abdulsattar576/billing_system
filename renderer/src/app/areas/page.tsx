"use client";

import React, { useEffect, useState, useRef } from "react";
import { initDB } from "../services/db"

export default function AreasPage() {
  const [db, setDb] = useState<any>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const [areaName, setAreaName] = useState("");
  const [loading, setLoading] = useState(true);
  const areaInputRef = useRef<HTMLInputElement>(null);

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

  const addArea = async () => {
    if (!db) return;
    if (!areaName.trim()) {
      alert('Please enter an area name');
      return;
    }

    try {
      await db.createArea(areaName);
      const allAreas = await db.getAreas();
      setAreas(allAreas);
      setAreaName("");
    
    } catch (err: any) {
      alert(err?.message || 'Failed to create area');
    }
  };

  const deleteArea = async (area: any) => {
    if (!db) return;
    await db.deleteArea(area);
    const allAreas = await db.getAreas();
    setAreas(allAreas);
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
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Areas Management</h1>
        <p className="text-gray-600">Add and manage service areas</p>
      </div>

      {/* Add Area Form Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Add New Area</h2>
        <div className="flex gap-4">
          <input
            ref={areaInputRef}
            type="text"
            value={areaName}
            onChange={(e) => setAreaName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addArea();
              }
            }}
            placeholder="Enter area name..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-500"
          />

          <button 
            onClick={addArea}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-700 text-white rounded-lg hover:from-blue-700 hover:to-purple-800 transition-colors duration-200 font-medium"
          >
            Add Area
          </button>
        </div>
      </div>

      {/* Areas List Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Existing Areas</h2>
          <p className="text-sm text-gray-500 mt-1">{areas.length} area(s) found</p>
        </div>

        {areas.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-400 text-lg mb-2">No areas found</div>
            <p className="text-gray-500">Add your first area using the form above</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Area Name
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
                {areas.map((area) => (
                  <tr key={area._id} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{area.name}</div>
                      </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button 
                        onClick={() => deleteArea(area)}
                        className="text-red-600 hover:text-red-900 hover:bg-red-50 px-3 py-1 rounded-md transition-colors duration-200"
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

      {/* Stats Cards - Similar to dashboard metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Areas</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{areas.length}</p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-100 text-blue-800">
              +0%
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-4">All service areas in system</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Areas</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{areas.length}</p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-green-100 text-green-800">
              100%
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-4">All areas are currently active</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600">Management</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">Ready</p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-purple-100 text-purple-800">
              ✓
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-4">System is operational</p>
        </div>
      </div>
    </div>
  );
}