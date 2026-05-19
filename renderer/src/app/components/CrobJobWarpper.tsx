"use client";
import { useEffect, useState } from "react";
import { setupMonthlyFeeCron } from "@/lib/cron-setup";

export default function ClientCronInitializer() {
  const [cronStarted, setCronStarted] = useState(false);

  useEffect(() => {
    // Only start cron once and after a delay
    if (!cronStarted) {
      const timer = setTimeout(() => {
        console.log("[ClientCronInitializer] Starting cron after delay...");
        try {
          setupMonthlyFeeCron();
          setCronStarted(true);
        } catch (err) {
          console.error("[ClientCronInitializer] Failed to start cron:", err);
        }
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [cronStarted]);

  return null;
}