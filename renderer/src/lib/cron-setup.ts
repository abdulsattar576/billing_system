// src/lib/cron-setup.ts
import { initDB } from "@/app/services/db";

let isDBReady = false;
let retryCount = 0;
const MAX_RETRIES = 5;

async function waitForDB(): Promise<boolean> {
  while (retryCount < MAX_RETRIES) {
    try {
      const db = await initDB();
      if (db && db.localDB) {
        // Test if DB is actually working with a timeout
        const infoPromise = db.localDB.info();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('DB info timeout')), 5000)
        );
        await Promise.race([infoPromise, timeoutPromise]);
        console.log('[Cron] Database is ready');
        isDBReady = true;
        return true;
      }
    } catch (err: any) {
      console.log(`[Cron] Waiting for DB... attempt ${retryCount + 1}/${MAX_RETRIES} - ${err?.message || 'unknown error'}`);
    }
    retryCount++;
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  return false;
}

export function setupMonthlyFeeCron() {
  if (typeof window === 'undefined') {
    console.log('[Cron] Skipping - not in browser');
    return;
  }

  const checkAndDeduct = async () => {
    try {
      // Reset retry count on each check
      retryCount = 0;
      isDBReady = false;
      
      // Wait for DB to be ready
      const ready = await waitForDB();
      if (!ready) {
        console.error('[Cron] Database not ready after retries, skipping this check');
        return;
      }

      console.log('[Cron] Checking monthly fee deduction...');
      
      const lastCheck = localStorage.getItem('last_monthly_fee_check');
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${now.getMonth()}`;
      
      console.log(`[Cron] Last check: ${lastCheck}, Current month: ${currentMonth}`);
      
      if (lastCheck === currentMonth) {
        console.log('[Cron] Already checked this month, skipping');
        return;
      }

      console.log('[Cron] Running monthly fee deduction...');
      
      const result = await runMonthlyDeduction();
      
      if (result.success) {
        console.log(`[Cron] Success! Deducted: ${result.deducted}, Skipped: ${result.skipped}, Errors: ${result.errors}`);
        localStorage.setItem('last_monthly_fee_check', currentMonth);
      } else {
        console.error('[Cron] Failed:', result.error);
      }
    } catch (error) {
      console.error('[Cron] Error:', error);
    }
  };

  // Run after longer delay (15 seconds)
  const initialTimeout = setTimeout(checkAndDeduct, 15000);
  
  // Check once per day
  const interval = setInterval(checkAndDeduct, 24 * 60 * 60 * 1000);
  
  return () => {
    clearTimeout(initialTimeout);
    clearInterval(interval);
  };
}

async function runMonthlyDeduction() {
  try {
    const db = await initDB();
    if (!db || !db.localDB) {
      return { success: false, error: "Database not initialized" };
    }

    // Test if DB is responsive with timeout
    let allPersons;
    try {
      const personsPromise = db.getAllPersons();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('getAllPersons timeout')), 10000)
      );
      allPersons = await Promise.race([personsPromise, timeoutPromise]);
    } catch (err) {
      console.error('Failed to get persons:', err);
      return { success: false, error: "Failed to fetch persons" };
    }

    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    const currentMonthName = now.toLocaleString("default", { month: "long", year: "numeric" });
    const todayDate = now.toISOString().slice(0, 10);
    
    const results = {
      month: currentMonthName,
      totalCustomers: allPersons.length,
      deducted: 0,
      skipped: 0,
      errors: 0,
      details: [] as any[],
    };

    for (const person of allPersons) {
      try {
        const monthlyFee = Number(person.amount || 0);
        
        if (monthlyFee <= 0) {
          results.skipped++;
          continue;
        }

        // Check if already deducted this month with timeout
        let allDocs;
        try {
          const docsPromise = db.localDB.allDocs({ include_docs: true });
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('allDocs timeout')), 5000)
          );
          allDocs = await Promise.race([docsPromise, timeoutPromise]);
        } catch (err) {
          console.error(`Failed to fetch docs for ${person.name}:`, err);
          results.errors++;
          continue;
        }

        const alreadyDeducted = allDocs.rows
          .map((r: any) => r.doc)
          .some(
            (d: any) =>
              d &&
              !d._deleted &&
              d.type === "customer-debit" &&
              d.personId === person._id &&
              d.month === currentMonth &&
              d.isMonthlyFee === true
          );

        if (alreadyDeducted) {
          results.skipped++;
          continue;
        }

        // Deduct the monthly fee
        try {
          await db.localDB.put({
            _id: `monthly_fee_${person._id}_${currentMonth}_${Date.now()}`,
            type: "customer-debit",
            areaId: person.areaId,
            personId: person._id,
            connectionNumber: person.connectionNumber,
            personName: person.name,
            personAddress: person.address,
            receiptNo: person.receiptNo,
            date: todayDate,
            amount: monthlyFee,
            description: `${currentMonthName} - Monthly Fee`,
            isMonthlyFee: true,
            month: currentMonth,
            createdAt: now.toISOString(),
          });
          results.deducted++;
        } catch (err) {
          console.error(`Failed to save deduction for ${person.name}:`, err);
          results.errors++;
        }
        
      } catch (err: any) {
        results.errors++;
        console.error(`Failed for ${person.name}:`, err);
      }
    }

    console.log(`[Cron] Deducted: ${results.deducted}, Skipped: ${results.skipped}, Errors: ${results.errors}`);
    return { success: true, ...results };
    
  } catch (error: any) {
    console.error("[Cron] Failed:", error);
    return { success: false, error: error.message };
  }
}

export async function manualTriggerMonthlyDeduction() {
  if (typeof window === 'undefined') return null;
  
  console.log('[Cron] Manual trigger...');
  const result = await runMonthlyDeduction();
  
  if (result.success) {
    alert(`Monthly fee deduction completed!\n\n✅ Deducted: ${result.deducted}\n⏭️ Skipped: ${result.skipped}\n❌ Errors: ${result.errors}`);
  } else {
    alert('❌ Failed: ' + result.error);
  }
  return result;
}

export async function checkNewConnectionDeduction(personId: string) {
  if (typeof window === 'undefined') return null;
  
  try {
    console.log('[Cron] Checking new connection for fee deduction...');
    const db = await initDB();
    if (!db) return null;

    const person = await db.localDB.get(personId);
    const monthlyFee = Number(person.amount || 0);
    
    if (monthlyFee <= 0) {
      return { success: true, message: "Monthly fee is zero" };
    }

    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    const currentMonthName = now.toLocaleString("default", { month: "long", year: "numeric" });
    const todayDate = now.toISOString().slice(0, 10);
    
    // Check if already deducted
    const allDocs = await db.localDB.allDocs({ include_docs: true });
    const alreadyDeducted = allDocs.rows
      .map((r: any) => r.doc)
      .some(
        (d: any) =>
          d &&
          !d._deleted &&
          d.type === "customer-debit" &&
          d.personId === personId &&
          d.month === currentMonth &&
          d.isMonthlyFee === true
      );
    
    if (!alreadyDeducted) {
      await db.localDB.put({
        _id: `monthly_fee_${personId}_${currentMonth}_${Date.now()}`,
        type: "customer-debit",
        areaId: person.areaId,
        personId: personId,
        connectionNumber: person.connectionNumber,
        personName: person.name,
        personAddress: person.address,
        receiptNo: person.receiptNo,
        date: todayDate,
        amount: monthlyFee,
        description: `${currentMonthName} - Monthly Fee`,
        isMonthlyFee: true,
        month: currentMonth,
        createdAt: now.toISOString(),
      });
      console.log(`[Cron] Deducted initial fee for ${person.name}`);
      return { success: true, deducted: true };
    }
    
    return { success: true, deducted: false };
  } catch (error) {
    console.error('[Cron] Error checking new connection:', error);
    return null;
  }
}

export function resetMonthlyCheck() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('last_monthly_fee_check');
  console.log('[Cron] Reset monthly check.');
  alert('✅ Monthly fee check reset. Reload the app to run deduction again.');
}