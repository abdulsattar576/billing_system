// src/app/components/DBInitializer.tsx
"use client";
import { useEffect, useState } from "react";
import { initDB } from "../services/db";

export default function DBInitializer() {
  const [db, setDB] = useState<any>(null);

  useEffect(() => {
    const setupDB = async () => {
      const database = await initDB();
      setDB(database);
      console.log("PouchDB initialized and live sync started");
    };
    setupDB();
  }, []);

  return null; // does not render anything
}
