"use client";

import React, { useEffect, useState } from 'react';
import { initDB } from '../services/db';

const DataTable: React.FC = () => {
  const [persons, setPersons] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    let changes: any = null;

    const sameDay = (iso: string | undefined) => {
      if (!iso) return false;
      try {
        const d = new Date(iso);
        const now = new Date();
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
      } catch (e) {
        return false;
      }
    };

    const loadTodaysPersons = async () => {
      const db = await initDB();
      if (!db) return;
      try {
        await db.localDB.createIndex({ index: { fields: ['type', 'createdAt', 'updatedAt', 'areaId'] } });
        const res = await db.localDB.find({ selector: { type: 'person' } });
        const all = res.docs || [];

        // map areaId -> name
        const areas = await db.getAreas();
        const areaMap = new Map(areas.map((a: any) => [a._id, a.name]));

        const todays = all.filter((p: any) => sameDay(p.createdAt) || sameDay(p.updatedAt));

        const withArea = todays.map((p: any) => ({
          ...p,
          areaName: areaMap.get(p.areaId) || '',
        }));

        if (!cancelled) setPersons(withArea);
      } catch (err) {
        console.warn('failed to load persons for today', err);
      }

      try {
        if (db) {
          changes = db.listenChanges((doc: any) => {
            if (doc.type === 'person') {
              loadTodaysPersons();
            }
          });
        }
      } catch (err) {
        // ignore
      }
    };

    loadTodaysPersons();

    return () => {
      cancelled = true;
      if (changes && typeof changes.cancel === 'function') {
        try { changes.cancel(); } catch (e) {}
      }
    };
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">Today's Persons</h3>
        <p className="text-sm text-gray-500 mt-1">Persons created or updated today</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Person</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conn #</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Area</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created / Updated</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {persons.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-sm text-gray-500">No persons created or updated today</td>
              </tr>
            ) : (
              persons.map((p) => (
                <tr key={p._id} className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{p.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.connectionNumber ?? p.number ?? '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.areaName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.updatedAt ? new Date(p.updatedAt).toLocaleString() : (p.createdAt ? new Date(p.createdAt).toLocaleString() : '-')}</td>
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