"use client";

import React, { useEffect, useState } from 'react';
import { initDB } from '../services/db';

const DataTable: React.FC = () => {
  const [persons, setPersons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTodaysPersons = async () => {
    setLoading(true);
    const db = await initDB();
    if (!db) return;
    
    try {
      // Get ALL documents
      const res = await db.localDB.allDocs({ include_docs: true });
      const allDocs = res.rows
        .map((row: any) => row.doc)
        .filter((doc: any) => doc && doc.type === 'person' && !doc._deleted);
      
      console.log('All persons from DB:', allDocs);
      
      // Use Map to keep only latest version of each person
      const latestPersonsMap = new Map();
      
      for (const person of allDocs) {
        const existing = latestPersonsMap.get(person._id);
        if (!existing) {
          latestPersonsMap.set(person._id, person);
        } else {
          const existingDate = new Date(existing.updatedAt || existing.createdAt);
          const newDate = new Date(person.updatedAt || person.createdAt);
          if (newDate > existingDate) {
            latestPersonsMap.set(person._id, person);
          }
        }
      }
      
      const uniquePersons = Array.from(latestPersonsMap.values());
      console.log('Unique persons:', uniquePersons);
      
      // Get area names
      const areas = await db.getAreas();
      const areaMap = new Map(areas.map((a: any) => [a._id, a.name]));
      
      const withArea = uniquePersons.map((p: any) => ({
        ...p,
        areaName: areaMap.get(p.areaId) || '',
      }));
      
      setPersons(withArea);
      
    } catch (err) {
      console.warn('Failed to load persons', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTodaysPersons();
    
    // Listen for changes
    let changes: any = null;
    const setupChanges = async () => {
      const db = await initDB();
      if (db) {
        changes = db.listenChanges((doc: any) => {
          if (doc.type === 'person') {
            loadTodaysPersons(); // Reload on any person change
          }
        });
      }
    };
    setupChanges();
    
    return () => {
      if (changes && typeof changes.cancel === 'function') {
        try { changes.cancel(); } catch (e) {}
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">Persons List</h3>
        <p className="text-sm text-gray-500 mt-1">All active connections ({persons.length})</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Person</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conn #</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Area</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {persons.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-sm text-gray-500 text-center">
                  No connections found
                </td>
              </tr>
            ) : (
              persons.map((p) => (
                <tr key={p._id} className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{p.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.connectionNumber ?? '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.areaName}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      p.status === 'active' ? 'bg-green-100 text-green-800' :
                      p.status === 'defaulter' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {p.status || 'active'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;