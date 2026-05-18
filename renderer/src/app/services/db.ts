// src/app/services/db.ts
export const initDB = async () => {
  if (typeof window === "undefined") return null; // only run in browser

  const PouchDB = (await import("pouchdb-browser")).default;
  const PouchDBFind = (await import("pouchdb-find")).default;

  PouchDB.plugin(PouchDBFind);

  const localDB = new PouchDB("crud-database");

  const savedUrl = localStorage.getItem("server_url");
  const savedDB = localStorage.getItem("server_db");
  const savedUser = localStorage.getItem("server_user");
  const savedPass = localStorage.getItem("server_pass");

  const remoteDbUrl =
    savedUrl && savedDB
      ? `${savedUrl.replace("http://", `http://${savedUser}:${savedPass}@`)}/${savedDB}`
      : null;

  console.log("Remote DB URL:", remoteDbUrl);

  const remoteDB = remoteDbUrl ? new PouchDB(remoteDbUrl) : null;

  // ---------------------------
  // LIVE TWO-WAY SYNC
  // ---------------------------
  const syncDB = () => {
    if (!remoteDB) {
      console.warn("No server IP configured — running in local-only mode");
      return;
    }
    localDB
      .sync(remoteDB, { live: true, retry: true })
      .on("change", (info) => console.log("DB Change:", info))
      .on("paused", () => console.log("Sync paused"))
      .on("active", () => console.log("Sync active"))
      .on("error", (err) => console.error("Sync error:", err));
  };

  // ---------------------------
  // REAL-TIME CHANGES LISTENER
  // ---------------------------
  const listenChanges = (onChange: (doc: any) => void) => {
    const changes = localDB
      .changes({ since: "now", live: true, include_docs: true })
      .on("change", (change) => {
        if (change.deleted) {
          onChange({ ...change.doc, _deleted: true });
        } else {
          onChange(change.doc);
        }
      });
    return changes;
  };

  // ---------------------------
  // AREA CRUD
  // ---------------------------
  const createArea = async (name: string) => {
    if (!name.trim()) throw new Error("Area name cannot be empty");
    const doc: any = {
      _id: `area_${name.toLowerCase()}_${Date.now()}`,
      type: "area",
      name,
      createdAt: new Date().toISOString(),
    };
    return localDB.put(doc);
  };

  const getAreas = async () => {
    await localDB.createIndex({ index: { fields: ["type"] } });
    const res = await localDB.find({ selector: { type: "area" }, limit: 1000 });
    return res.docs;
  };

  const deleteArea = async (area: any) => {
    return localDB.remove(area);
  };

  // ---------------------------
  // PERSON CRUD
  // ---------------------------
  const createPerson = async (
    name: string,
    areaId: string,
    connectionNumber?: string,
    amount?: number,          // monthly fee
    address?: string,
    amountPaid: number = 0,   // kept for compatibility, defaults to 0
    remainingBalance?: number,
    receiptNo?: string,
    phoneNumber?: string      // new field
  ) => {
    if (!name.trim() || !areaId) throw new Error("Invalid input");

    const conn = connectionNumber !== undefined ? String(connectionNumber).trim() : "";
    if (!conn) throw new Error("Connection number is required for a person");

    const receipt = receiptNo !== undefined ? String(receiptNo).trim() : "";
    if (!receipt) throw new Error("Receipt number is required for a person");

    // ✅ FIX: Check uniqueness ONLY within the same area (not globally)
    const allDocs = await localDB.allDocs({ include_docs: true });
    const duplicateInArea = allDocs.rows
      .map((row: any) => row.doc)
      .find(
        (doc: any) =>
          doc &&
          !doc._deleted &&
          doc.type === "person" &&
          doc.areaId === areaId &&                    // same area only
          doc.connectionNumber === conn &&
          doc.status !== "disconnected" &&
          doc.status !== "defaulter"
      );

    if (duplicateInArea) {
      throw new Error(
        `Connection number ${conn} is already assigned to "${duplicateInArea.name}" in this area`
      );
    }

    const monthlyFeeNum = Number(amount || 0);
    const paidNum = Number(amountPaid || 0);
    const calculatedRemaining = monthlyFeeNum - paidNum;

    const doc: any = {
      _id: `person_${areaId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      type: "person",
      name: name.trim(),
      areaId,
      connectionNumber: conn,
      receiptNo: receipt,
      amount: monthlyFeeNum,
      address: address?.trim() || "-",
      amountPaid: paidNum,
      remainingBalance: Number(remainingBalance ?? calculatedRemaining),
      phoneNumber: phoneNumber?.trim() || "",
      status: "active",
      createdAt: new Date().toISOString(),
    };

    return localDB.put(doc);
  };

  const getPersonsByArea = async (areaId: string) => {
    const res = await localDB.allDocs({ include_docs: true });
    return res.rows
      .map((row: any) => row.doc)
      .filter(
        (doc: any) =>
          doc &&
          !doc._deleted &&
          doc.type === "person" &&
          doc.areaId === areaId &&
          doc.status === "active"
      );
  };

  const getDefaulterPersons = async (areaId: string) => {
    const res = await localDB.allDocs({ include_docs: true });
    return res.rows
      .map((row: any) => row.doc)
      .filter(
        (doc: any) =>
          doc &&
          !doc._deleted &&
          doc.type === "person" &&
          doc.areaId === areaId &&
          doc.status === "defaulter"
      );
  };

  const updatePerson = async (person: any, updates: any) => {
    if (!person._id || !person._rev) throw new Error("_id and _rev required");
    const updatedDoc = { ...person, ...updates, updatedAt: new Date().toISOString() };
    return localDB.put(updatedDoc);
  };

  const moveTodefalterList = async (person: any) => {
    try {
      const updatedPerson = {
        ...person,
        status: "defaulter",
        movedToDefaulterAt: new Date().toISOString(),
      };
      await localDB.put(updatedPerson);
      console.log(`Person ${person._id} moved to defaulter list`);
      return { success: true, movedToDefaulter: true };
    } catch (err: any) {
      console.error("Error moving person to defaulter list:", err);
      throw new Error("Failed to move person to defaulter list: " + (err?.message || "Unknown error"));
    }
  };

  const moveToDisconnected = async (person: any) => {
    const updatedPerson = {
      ...person,
      status: "disconnected",
      disconnectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return localDB.put(updatedPerson);
  };

  const reconnectPerson = async (person: any) => {
    const updatedPerson = {
      ...person,
      status: "active",
      disconnectedAt: null,
      updatedAt: new Date().toISOString(),
    };
    return localDB.put(updatedPerson);
  };

  const getDisconnectedPersons = async (areaId: string) => {
    const res = await localDB.allDocs({ include_docs: true });
    return res.rows
      .map((row: any) => row.doc)
      .filter(
        (doc: any) =>
          doc &&
          !doc._deleted &&
          doc.type === "person" &&
          doc.areaId === areaId &&
          doc.status === "disconnected"
      );
  };

  const getAllDisconnected = async () => {
    const res = await localDB.allDocs({ include_docs: true });
    return res.rows
      .map((row: any) => row.doc)
      .filter(
        (doc: any) =>
          doc && !doc._deleted && doc.type === "person" && doc.status === "disconnected"
      );
  };
// fee_list
const createFeeList = async (description: string, amount: number) => {
  const doc = {
    _id: `fee_${Date.now()}`,
    type: "feeList",
    description,
    amount: Number(amount),
    createdAt: new Date().toISOString(),
  };

  return localDB.put(doc);
};
//get_feeList
const getFeeList = async () => {
  const res = await localDB.find({
    selector: { type: "feeList" },
  });

  return res.docs;
};
// update fee list
const updateFeeList = async (fee: any, updates: any) => {
  if (!fee._id || !fee._rev) throw new Error("_id and _rev required");

  return localDB.put({
    ...fee,
    ...updates,
    updatedAt: new Date().toISOString(),
  });
};
// delete fee list
const deleteFeeList = async (fee: any) => {
  return localDB.remove(fee);
};

  const deletePerson = async (person: any) => {
    try {
      if (person.status === "defaulter") {
        await localDB.remove(person);

        const debitsResult = await localDB.find({
          selector: { type: "debit", personId: person._id },
        });
        const debits = debitsResult.docs || [];
        for (const debit of debits) {
          await localDB.remove(debit);
        }

        console.log(`Deleted person ${person._id} and ${debits.length} related debit records`);
        return { success: true, deletedDebits: debits.length, fullyDeleted: true };
      } else {
        return await moveTodefalterList(person);
      }
    } catch (err: any) {
      console.error("Error during person deletion:", err);
      throw new Error("Failed to delete person: " + (err?.message || "Unknown error"));
    }
  };

  // ---------------------------
  // AGGREGATION HELPERS
  // ---------------------------
  const getAllPersons = async () => {
    const res = await localDB.allDocs({ include_docs: true });
    return res.rows
      .map((row: any) => row.doc)
      .filter(
        (doc: any) =>
          doc && !doc._deleted && doc.type === "person" && doc.status === "active"
      );
  };

  const getAllDefaulters = async () => {
    const res = await localDB.allDocs({ include_docs: true });
    return res.rows
      .map((row: any) => row.doc)
      .filter(
        (doc: any) =>
          doc && !doc._deleted && doc.type === "person" && doc.status === "defaulter"
      );
  };

  const totalConnections = async () => {
    const persons = await getAllPersons();
    return persons.length;
  };

  const grandTotalRevenue = async () => {
    const persons = await getAllPersons();
    return persons.reduce((sum: number, d: any) => sum + (Number(d.amount) || 0), 0);
  };

  const monthlyRevenue = async (year: number, month: number) => {
    const persons = await getAllPersons();
    return persons.reduce((sum: number, d: any) => {
      if (!d.createdAt) return sum;
      const dt = new Date(d.createdAt);
      if (dt.getFullYear() === year && dt.getMonth() + 1 === month) {
        return sum + (Number(d.amount) || 0);
      }
      return sum;
    }, 0);
  };

  const monthlyRevenueHistory = async (monthsBack = 12) => {
    const persons = await getAllPersons();
    const map: Record<string, number> = {};
    const now = new Date();

    for (let i = 0; i < monthsBack; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map[key] = 0;
    }

    persons.forEach((d: any) => {
      if (!d.createdAt) return;
      const dt = new Date(d.createdAt);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      if (map[key] !== undefined) {
        map[key] += Number(d.amount) || 0;
      }
    });

    return Object.keys(map).map((k) => ({ month: k, total: map[k] }));
  };

  // ---------------------------
  // INTERNET ENTRY CRUD
  // ---------------------------
  const createInternetEntry = async (
    name: string,
    fatherName: string,
    cnic: string,
    phone: string,
    address: string,
    areaId: string,
    connectionNumber?: string,
    routerNo?: string,
    monthlyFee?: number,
    installationFee?: number,
    pendingAmount?: number
  ) => {
    if (!name.trim() || !areaId) throw new Error("Invalid input");

    const conn = connectionNumber !== undefined ? String(connectionNumber).trim() : "";
    const router = routerNo !== undefined ? String(routerNo).trim() : "";

    const doc: any = {
      _id: `internet_${areaId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      type: "internet-entry",
      name,
      fatherName,
      cnic,
      phone,
      address,
      areaId,
      connectionNumber: conn || null,
      routerNo: router || null,
      createdAt: new Date().toISOString(),
    };

    if (monthlyFee !== undefined && !Number.isNaN(Number(monthlyFee))) {
      doc.monthlyFee = Number(monthlyFee);
    }
    if (installationFee !== undefined && !Number.isNaN(Number(installationFee))) {
      doc.installationFee = Number(installationFee);
    }
    if (pendingAmount !== undefined && !Number.isNaN(Number(pendingAmount))) {
      doc.pendingAmount = Number(pendingAmount);
    }

    return localDB.put(doc);
  };

  const getInternetEntriesByArea = async (areaId: string) => {
    await localDB.createIndex({ index: { fields: ["type", "areaId"] } });
    const res = await localDB.find({ selector: { type: "internet-entry", areaId } });
    return res.docs;
  };

  const deleteInternetEntry = async (entry: any) => {
    return localDB.remove(entry);
  };

  const searchInternetEntries = async (query: string) => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    await localDB.createIndex({
      index: { fields: ["type", "name", "cnic", "connectionNumber"] },
    });
    const result = await localDB.find({
      selector: {
        type: "internet-entry",
        $or: [
          { name: { $regex: new RegExp(q, "i") } },
          { cnic: { $regex: new RegExp(q, "i") } },
          { connectionNumber: { $regex: new RegExp(q, "i") } },
        ],
      },
    });
    return result.docs;
  };

  // AUTOMATIC SYNC ON INIT
  syncDB();

  // ---------------------------
  // USER AUTH
  // ---------------------------
  const hashPassword = async (password: string): Promise<string> => {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch (error) {
      console.error("Error hashing password:", error);
      throw new Error("Failed to hash password");
    }
  };

  const verifyPassword = async (password: string, hashedPassword: string): Promise<boolean> => {
    try {
      const hashedInput = await hashPassword(password);
      return hashedInput === hashedPassword;
    } catch (error) {
      console.error("Error verifying password:", error);
      return false;
    }
  };

  const createUser = async (username: string, password: string, role: "admin" | "op") => {
    if (!username.trim() || !password.trim()) throw new Error("Invalid input");
    const existing = await localDB.find({
      selector: { type: "user", username: username.toLowerCase() },
    });
    if (existing.docs.length > 0) throw new Error("User already exists");
    const hashedPassword = await hashPassword(password);
    const doc = {
      _id: `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      type: "user",
      username: username.toLowerCase(),
      password: hashedPassword,
      role,
      createdAt: new Date().toISOString(),
    };
    return localDB.put(doc);
  };

  const getUser = async (username: string, password: string) => {
    const res = await localDB.find({
      selector: { type: "user", username: username.toLowerCase() },
    });
    if (res.docs.length === 0) return null;
    const user = res.docs[0] as any;
    const isPasswordValid = await verifyPassword(password, user.password);
    if (isPasswordValid) {
      return { username: user.username, role: user.role };
    }
    return null;
  };

  const getAllUsers = async () => {
    const res = await localDB.find({ selector: { type: "user" } });
    return res.docs;
  };
// Add to db.ts - Unified balance calculation
const calculateCustomerBalance = async (personId: string) => {
  try {
    const res = await localDB.allDocs({ include_docs: true });
    const docs = res.rows
      .map((r: any) => r.doc)
      .filter((d: any) => d && !d._deleted && d.personId === personId);

    // Get person details
    const person = docs.find((d: any) => d.type === "person");
    if (!person) return 0;

    const monthlyFee = Number(person.amount || 0);
    const connectionDate = new Date(person.createdAt);
    const currentDate = new Date();
    
    // Calculate expected monthly fees from connection date to current month
    let expectedTotalFees = 0;
    let feeDate = new Date(connectionDate.getFullYear(), connectionDate.getMonth() + 1, 1);
    const today = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    // Get paid months
    const paidMonthsSet = new Set();
    docs
      .filter((d: any) => d.type === "payment")
      .forEach((p: any) => {
        if (p.paymentMonth) paidMonthsSet.add(p.paymentMonth);
      });
    
    while (feeDate <= today) {
      const monthStr = feeDate.toISOString().slice(0, 7);
      if (!paidMonthsSet.has(monthStr)) {
        expectedTotalFees += monthlyFee;
      }
      feeDate.setMonth(feeDate.getMonth() + 1);
    }

    // Calculate all transactions
    const totalPurchases = docs
      .filter((d: any) => d.type === "customer-debit")
      .reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);

    const totalConcessions = docs
      .filter((d: any) => d.type === "credit-note")
      .reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);

    const totalPayments = docs
      .filter((d: any) => d.type === "payment")
      .reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);
      
    const totalDebitPayments = docs
      .filter((d: any) => d.type === "debit-payment")
      .reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);

    // Balance Formula: (Payments + Concessions) - (Fees + Purchases)
    const totalCredit = totalPayments + totalDebitPayments + totalConcessions;
    const totalDebit = expectedTotalFees + totalPurchases;
    const balance = totalCredit - totalDebit;
    
    return balance;
  } catch (e) {
    console.error("Failed to calculate balance", e);
    return 0;
  }
};

const getPendingMonths = async (personId: string) => {
  try {
    const res = await localDB.allDocs({ include_docs: true });
    const docs = res.rows
      .map((r: any) => r.doc)
      .filter((d: any) => d && !d._deleted && d.personId === personId);

    const person = docs.find((d: any) => d.type === "person");
    if (!person) return [];

    const monthlyFee = Number(person.amount || 0);
    const connectionDate = new Date(person.createdAt);
    const currentDate = new Date();
    
    const paidMonthsSet = new Set();
    docs
      .filter((d: any) => d.type === "payment")
      .forEach((p: any) => {
        if (p.paymentMonth) paidMonthsSet.add(p.paymentMonth);
      });
    
    const pending = [];
    let feeDate = new Date(connectionDate.getFullYear(), connectionDate.getMonth() + 1, 1);
    const today = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    while (feeDate <= today) {
      const monthStr = feeDate.toISOString().slice(0, 7);
      if (!paidMonthsSet.has(monthStr)) {
        pending.push({
          month: monthStr,
          monthName: feeDate.toLocaleString('default', { month: 'long', year: 'numeric' }),
          amount: monthlyFee,
        });
      }
      feeDate.setMonth(feeDate.getMonth() + 1);
    }
    
    return pending;
  } catch (e) {
    console.error("Failed to get pending months", e);
    return [];
  }
};

// Add to return statement at the end of db.ts
 
  // ... existing returns ...
  
 
  return {
    localDB,
    remoteDB,
    syncDB,
    listenChanges,
    createArea,
    getAreas,
    deleteArea,
    createPerson,
    getPersonsByArea,
    getDefaulterPersons,
    updatePerson,
    deletePerson,
    moveTodefalterList,
    getAllDefaulters,
    moveToDisconnected,
    reconnectPerson,
    getDisconnectedPersons,
    getAllDisconnected,
    totalConnections,
    grandTotalRevenue,
    monthlyRevenue,
    monthlyRevenueHistory,
    getAllPersons,
    createInternetEntry,
    getInternetEntriesByArea,
    deleteInternetEntry,
    searchInternetEntries,
    createUser,
    getUser,
    getAllUsers,
    createFeeList,
getFeeList,
updateFeeList,
deleteFeeList,
calculateCustomerBalance,
  getPendingMonths,
  };
};