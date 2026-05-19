// src/app/components/CrobJobWarpper.tsx
"use client";
import { setupMonthlyFeeCron } from "@/lib/cron-setup";
import { useEffect, useState } from "react";

export default function ClientCronInitializer() {
  const [cronStarted, setCronStarted] = useState(false);

  useEffect(() => {
    // Only start cron once and after a longer delay
    if (!cronStarted) {
      const timer = setTimeout(() => {
        console.log("[ClientCronInitializer] Starting cron after delay...");
        try {
          const cleanup = setupMonthlyFeeCron();
          setCronStarted(true);
          return cleanup;
        } catch (err) {
          console.error("[ClientCronInitializer] Failed to start cron:", err);
        }
      }, 8000);

      return () => clearTimeout(timer);
    }
  }, [cronStarted]);

  return null;
}
