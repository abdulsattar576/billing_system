// app/api/deduct-monthly-fees/route.ts
import { initDB } from "@/app/services/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { month } = await request.json();
    const db = await initDB();
    
    if (!db) {
      return NextResponse.json({ error: "Database not initialized" }, { status: 500 });
    }

    // Use current month if not specified
    const currentMonth = month || new Date().toISOString().slice(0, 7);
    const [year, monthNum] = currentMonth.split('-');
    
    // Get all active customers
    const allPersons = await db.getAllPersons();
    
    let deducted = 0;
    let skipped = 0;

    for (const person of allPersons) {
      // Check if fee already deducted for this month
      const existingFee = await db.localDB.find({
        selector: {
          type: "monthly-fee-deduction",
          personId: person._id,
          month: currentMonth
        }
      });

      if (existingFee.docs.length === 0) {
        // Create monthly fee deduction record
        await db.localDB.put({
          _id: `monthly_fee_${person._id}_${currentMonth}`,
          type: "monthly-fee-deduction",
          personId: person._id,
          areaId: person.areaId,
          connectionNumber: person.connectionNumber,
          personName: person.name,
          amount: Number(person.amount || 0),
          month: currentMonth,
          description: `Monthly fee deduction for ${currentMonth}`,
          deductedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        });
        
        deducted++;
      } else {
        skipped++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      deducted, 
      skipped,
      month: currentMonth,
      message: `Deducted fees for ${deducted} customers`
    });
    
  } catch (error: any) {
    console.error("Monthly fee deduction error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}