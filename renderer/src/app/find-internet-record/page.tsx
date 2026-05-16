"use client";

import React, { useEffect, useState } from "react";
import { initDB } from "@/app/services/db";

export default function FindInternetRecordPage() {
  const [db, setDb] = useState<any>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const [selectedArea, setSelectedArea] = useState("");
  const [entries, setEntries] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

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

  const loadEntries = async (areaId: string) => {
    if (!db) return;
    setSelectedArea(areaId);
    const allEntries = await db.getInternetEntriesByArea(areaId);
    setEntries(allEntries);
    setSearchResults([]); // Clear previous search results when area changes
  };

  const searchEntries = async () => {
    if (!db || !searchQuery.trim() || !selectedArea) return;
    
    setIsSearching(true);
    

    const results = await db.searchInternetEntries(searchQuery);
    
    // Filter results to only include entries from the selected area
    const filteredResults = results.filter((entry: any) => 
      entry.areaId === selectedArea
    );
    
    setSearchResults(filteredResults);
    setIsSearching(false);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
  };

  const deleteEntry = async (entry: any) => {
    if (!db) return;
    await db.deleteInternetEntry(entry);
    const allEntries = await db.getInternetEntriesByArea(selectedArea);
    setEntries(allEntries);
    
    // Update search results if we have an active search
    if (searchQuery.trim()) {
      const results = await db.searchInternetEntries(searchQuery);
      const filteredResults = results.filter((e: any) => 
        e.areaId === selectedArea
      );
      setSearchResults(filteredResults);
    } else {
      setSearchResults([]);
    }
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
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Find Internet Records</h1>
        <p className="text-gray-600">Search and manage internet customer records across different areas</p>
      </div>

      {/* Area Selection Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Select Area</h2>
        <div className="flex gap-4 items-center">
          <select
            value={selectedArea}
            onChange={(e) => loadEntries(e.target.value)}
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

      {/* Search Form Card - Only show when area is selected */}
      {selectedArea && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Search Records</h2>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search by Name, CNIC or Connection #
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter name, CNIC or connection number to search..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-500"
                onKeyPress={(e) => e.key === 'Enter' && searchEntries()}
              />
            </div>
            <div className="flex gap-2">
              <button 
                onClick={searchEntries}
                disabled={isSearching || !searchQuery.trim()}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-700 text-white rounded-lg hover:from-blue-700 hover:to-purple-800 transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSearching ? 'Searching...' : 'Search Records'}
              </button>
              <button 
                onClick={clearSearch}
                className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200 font-medium"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Results Card - Only show when area is selected and we have results */}
      {selectedArea && (searchResults.length > 0 || (searchQuery && !isSearching)) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">Search Results</h2>
            <p className="text-sm text-gray-500 mt-1">
              {searchResults.length} record(s) found for "{searchQuery}"
            </p>
          </div>

          {searchResults.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-gray-400 text-lg mb-2">No records found</div>
              <p className="text-gray-500">No matches found for your search criteria</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      CNIC
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Connection #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Router No
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Monthly Fee
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
                  {searchResults.map((entry) => (
                    <tr key={entry._id} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{entry.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{entry.cnic || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{entry.phone || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{entry.connectionNumber || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{entry.routerNo || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{entry.address || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{entry.monthlyFee ? `Rs.${Number(entry.monthlyFee).toFixed(2)}` : '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button 
                          onClick={() => deleteEntry(entry)}
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
      )}

      {/* All Records Card - Show when area is selected but no search is active */}
      {selectedArea && !searchQuery && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">All Records in Area</h2>
            <p className="text-sm text-gray-500 mt-1">{entries.length} record(s) total</p>
          </div>

          {entries.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-gray-400 text-lg mb-2">No records found in this area</div>
              <p className="text-gray-500">Use the search function to find specific records</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      CNIC
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Connection #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Router No
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Monthly Fee
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
                  {entries.map((entry) => (
                    <tr key={entry._id} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{entry.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{entry.cnic || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{entry.phone || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{entry.connectionNumber || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{entry.routerNo || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{entry.address || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{entry.monthlyFee ? `Rs.${Number(entry.monthlyFee).toFixed(2)}` : '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button 
                          onClick={() => deleteEntry(entry)}
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
      )}

      {/* Stats Cards - Similar to dashboard metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Records</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{entries.length}</p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-100 text-blue-800">
              +0%
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-4">All records in selected area</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600">Search Results</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{searchResults.length}</p>
            </div>
            <span className={`text-xs font-semibold px-2 py-1 rounded ${
              searchResults.length > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {searchResults.length > 0 ? 'Found' : 'None'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-4">Matching search criteria</p>
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
