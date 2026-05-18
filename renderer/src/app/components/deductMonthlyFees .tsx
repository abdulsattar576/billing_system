"use client";

import { useState } from "react";

const deductMonthlyFees = async () => {
  const [loading, setLoading] = useState(false);
  const month = new Date().toISOString().slice(0, 7);
  if (
    !confirm(
      `Deduct monthly fees for ${month}? This will add fee records for all active customers.`,
    )
  )
    return;

  setLoading(true);
  try {
    const response = await fetch("/api/deduct-monthly-fees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month }),
    });

    const result = await response.json();
    if (result.success) {
      alert(
        `✅ Deducted fees for ${result.count} customers\nMonth: ${result.month}`,
      );
    } else {
      alert(`❌ Error: ${result.error}`);
    }
  } catch (error) {
    alert("Failed to deduct monthly fees");
  }
  setLoading(false);
};
