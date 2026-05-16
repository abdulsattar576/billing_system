
"use client";

import React, { useEffect, useState } from 'react';
import { initDB } from '@/app/services/db';

interface SearchSectionProps {
  onSearch: (query: string) => void;
}

const SearchSection: React.FC<SearchSectionProps> = ({ onSearch }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [areas, setAreas] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const db = await initDB();
      if (!db) return;
      try {
        const a = await db.getAreas();
        if (!cancelled) setAreas(a || []);
      } catch (e) {
        console.warn('failed to load areas for search', e);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  useEffect(() => {
    const q = String(searchQuery || '').trim().toLowerCase();
    if (!q) {
      setSuggestions([]);
      return;
    }
    const list = areas.filter((a: any) => {
      const name = String(a.name || '').toLowerCase();
      return name.includes(q);
    }).slice(0, 10);
    setSuggestions(list);
  }, [searchQuery, areas]);

  const handleSelectArea = (area: any) => {
    setSearchQuery(area.name);
    setSuggestions([]);
    // pass back the selected area's id so parent can react
    onSearch(area._id);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6 relative">
      <form onSubmit={handleSubmit} className="flex gap-4">
        <input
          type="text"
          placeholder="Search areas or records..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-black placeholder-gray-500"
        />

        <button
          type="submit"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium text-sm"
        >
          Search
        </button>
      </form>

      {suggestions.length > 0 && (
        <div className="absolute left-6 right-6 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <ul className="max-h-56 overflow-auto">
            {suggestions.map((s) => (
              <li
                key={s._id}
                onClick={() => handleSelectArea(s)}
                className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100"
              >
                <div className="text-sm font-medium text-gray-900">{s.name}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SearchSection;