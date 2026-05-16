"use client";

import React, { useEffect, useState } from "react";
import MetricsCards from "../components/MetricsCards";
import SearchSection from "../components/SearchSection";
import DataTable from "../components/DataTable";
import { initDB } from "../services/db";

const DashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<any[] | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    let changesHandle: any = null;
    let intervalHandle: any = null;

    const recalc = async (db: any) => {
      try {
        const now = new Date();
        const monthSum = await db.monthlyRevenue(now.getFullYear(), now.getMonth() + 1);
        const grand = await db.grandTotalRevenue();
        const totalConn = await db.totalConnections();
        const areas = await db.getAreas();
        const areasCount = Array.isArray(areas) ? areas.length : 0;

        const m = [
          { title: 'Monthly Revenue', value: `Rs.${Number(monthSum).toFixed(2)}`, change: '', trend: 'up', description: 'Revenue for current month' },
          { title: 'All-Time Revenue', value: `Rs.${Number(grand).toFixed(2)}`, change: '', trend: 'up', description: 'Cumulative revenue' },
          { title: 'Active Areas', value: String(areasCount), change: '', trend: 'up', description: 'Number of areas' },
          { title: 'Active Connections', value: String(totalConn), change: '', trend: 'up', description: 'Number of person connections' },
        ];

        if (!cancelled) setMetrics(m as any);
      } catch (err) {
        console.warn('failed to load metrics', err);
      }
    };

    const load = async () => {
      const db = await initDB();
      if (!db) return;
      await recalc(db);

      try {
        changesHandle = db.listenChanges((doc: any) => {
          if (doc.type === 'person' || doc.type === 'area') {
            recalc(db);
          }
        });
      } catch (err) {
        console.warn('listenChanges failed', err);
      }

      intervalHandle = setInterval(() => recalc(db), 1000 * 60 * 60);
    };

    load();

    return () => {
      cancelled = true;
      if (changesHandle && typeof changesHandle.cancel === 'function') {
        try { changesHandle.cancel(); } catch (e) {}
      }
      if (intervalHandle) clearInterval(intervalHandle);
    };
  }, []);

  const handleSearch = (query: string) => {
    console.log("Searching for:", query);
  };

  return (
    <>
      <MetricsCards metrics={metrics} />
      <SearchSection onSearch={handleSearch} />
      <DataTable />
    </>
  );
};

export default DashboardPage;
