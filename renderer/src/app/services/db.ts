import { checkNewConnectionDeduction } from "@/lib/cron-setup";

export const initDB = async () => {
  if (typeof window === "undefined") return null; // only run in browser

  const PouchDB = (await import("pouchdb-browser")).default;
  const PouchDBFind = (await import("pouchdb-find")).default;

  PouchDB.plugin(PouchDBFind);

const localDB = new PouchDB("crud-database");

const DB_USER = "admin";
const DB_PASS = "512141";
const DB_NAME = "db_fcn";

const rawServerUrl = localStorage.getItem("server_url") || "";

const cleanServerHost = rawServerUrl
  .replace("http://", "")
  .replace("https://", "")
  .replace(":5984", "")
  .replace(/\/$/, "")
  .trim();

const remoteDB = cleanServerHost
  ? new PouchDB(`http://${DB_USER}:${DB_PASS}@${cleanServerHost}:5984/${DB_NAME}`)
  : null;

 
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
  // Helper: Get Latest Version of Documents
  // ---------------------------
  const getLatestDocuments = (docs: any[], uniqueKey: string = "_id") => {
    const latestMap = new Map();
    
    for (const doc of docs) {
      if (!doc || doc._deleted) continue;
      
      const key = doc[uniqueKey];
      const existing = latestMap.get(key);
      
      if (!existing) {
        latestMap.set(key, doc);
      } else {
        const existingDate = new Date(existing.updatedAt || existing.createdAt || 0);
        const newDate = new Date(doc.updatedAt || doc.createdAt || 0);
        if (newDate > existingDate) {
          latestMap.set(key, doc);
        }
      }
    }
    
    return Array.from(latestMap.values());
  };

  // ---------------------------
  // PERSON CRUD
  // ---------------------------
  const createPerson = async (
    name: string,
    areaId: string,
    connectionNumber?: string,
    amount?: number,
    address?: string,
    amountPaid: number = 0,
    remainingBalance?: number,
    receiptNo?: string,
    phoneNumber?: string
  ) => {
    if (!name.trim() || !areaId) throw new Error("Invalid input");

    const conn = connectionNumber !== undefined ? String(connectionNumber).trim() : "";
    if (!conn) throw new Error("Connection number is required for a person");

    const receipt = receiptNo !== undefined ? String(receiptNo).trim() : "";
    if (!receipt) throw new Error("Receipt number is required for a person");

    // Get all documents and filter to latest versions for duplicate check
    const allDocs = await localDB.allDocs({ include_docs: true });
    const allPersons = allDocs.rows
      .map((row: any) => row.doc)
      .filter((doc: any) => doc && !doc._deleted && doc.type === "person");
    
    // Get only the latest version of each person for duplicate check
    const latestPersons = getLatestDocuments(allPersons, "connectionNumber");
    
    const duplicateInArea = latestPersons.find(
      (doc: any) =>
        doc.areaId === areaId &&
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
    
    const doc: any = {
      _id: `person_${areaId}_${conn}_${Date.now()}`, // Use connection number in ID for uniqueness
      type: "person",
      name: name.trim(),
      areaId,
      connectionNumber: conn,
      receiptNo: receipt,
      amount: monthlyFeeNum,
      address: address?.trim() || "-",
      amountPaid: paidNum,
      remainingBalance: Math.abs(monthlyFeeNum),
      currentBalance: -monthlyFeeNum, // Initial balance: customer owes monthly fee
      phoneNumber: phoneNumber?.trim() || "",
      status: "active",
      createdAt: new Date().toISOString(),
    };

    // Save the person first
    const result = await localDB.put(doc);
    
    // Create initial debit record for the current month's fee
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    const currentMonthName = now.toLocaleString("default", { month: "long", year: "numeric" });
    
    if (monthlyFeeNum > 0) {
      await localDB.put({
        _id: `monthly_fee_${result.id}_${currentMonth}_${Date.now()}`,
        type: "customer-debit",
        areaId: areaId,
        personId: result.id,
        connectionNumber: conn,
        personName: name.trim(),
        personAddress: address?.trim() || "-",
        receiptNo: receipt,
        date: now.toISOString().slice(0, 10),
        amount: monthlyFeeNum,
        description: `${currentMonthName} - Monthly Fee (Initial)`,
        isMonthlyFee: true,
        month: currentMonth,
        createdAt: now.toISOString(),
      });
    }
    
    return result;
  };
const createCashReceivedRecord = async (data: any) => {
  const now = new Date().toISOString();

  const doc: any = {
    _id: `debit_${data.areaId}_${data.personId}_${Date.now()}`,
    type: "debit",
    areaId: data.areaId,
    personId: data.personId,
    personName: data.personName,
    personAddress: data.personAddress || "-",
    personMonthlyFee: Number(data.personMonthlyFee || 0),
    connectionNumber: data.connectionNumber || "",
    receiptNo: data.receiptNo,
    description: data.description,
    amount: Number(data.amount || 0),
    lateFeeCharges: Number(data.lateFeeCharges || 0),
    date: now.slice(0, 10),
    month: now.slice(0, 7),
    createdAt: now,
  };

  await localDB.put(doc);
  return doc;
};
  const getPersonsByArea = async (areaId: string) => {
    const res = await localDB.allDocs({ include_docs: true });
    const allPersons = res.rows
      .map((row: any) => row.doc)
      .filter(
        (doc: any) =>
          doc &&
          !doc._deleted &&
          doc.type === "person" &&
          doc.areaId === areaId &&
          doc.status === "active"
      );
    
    // Return only the latest version of each person
    return getLatestDocuments(allPersons, "connectionNumber");
  };

  const getDefaulterPersons = async (areaId: string) => {
    const res = await localDB.allDocs({ include_docs: true });
    const allPersons = res.rows
      .map((row: any) => row.doc)
      .filter(
        (doc: any) =>
          doc &&
          !doc._deleted &&
          doc.type === "person" &&
          doc.areaId === areaId &&
          doc.status === "defaulter"
      );
    
    return getLatestDocuments(allPersons, "connectionNumber");
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
        updatedAt: new Date().toISOString(),
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
    const allPersons = res.rows
      .map((row: any) => row.doc)
      .filter(
        (doc: any) =>
          doc &&
          !doc._deleted &&
          doc.type === "person" &&
          doc.areaId === areaId &&
          doc.status === "disconnected"
      );
    
    return getLatestDocuments(allPersons, "connectionNumber");
  };

  const getAllDisconnected = async () => {
    const res = await localDB.allDocs({ include_docs: true });
    const allPersons = res.rows
      .map((row: any) => row.doc)
      .filter(
        (doc: any) =>
          doc && !doc._deleted && doc.type === "person" && doc.status === "disconnected"
      );
    
    return getLatestDocuments(allPersons, "connectionNumber");
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

  const getFeeList = async () => {
    const res = await localDB.find({
      selector: { type: "feeList" },
    });
    return res.docs;
  };

  const updateFeeList = async (fee: any, updates: any) => {
    if (!fee._id || !fee._rev) throw new Error("_id and _rev required");
    return localDB.put({
      ...fee,
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  };

  const deleteFeeList = async (fee: any) => {
    return localDB.remove(fee);
  };

  const deletePerson = async (person: any) => {
    try {
      if (person.status === "defaulter") {
        await localDB.remove(person);
        console.log(`Deleted person ${person._id}`);
        return { success: true, fullyDeleted: true };
      } else {
        return await moveTodefalterList(person);
      }
    } catch (err: any) {
      console.error("Error during person deletion:", err);
      throw new Error("Failed to delete person: " + (err?.message || "Unknown error"));
    }
  };

  // ---------------------------
  // AGGREGATION HELPERS (WITH LATEST VERSION ONLY)
  // ---------------------------
  const getAllPersons = async () => {
    const res = await localDB.allDocs({ include_docs: true });
    const allPersons = res.rows
      .map((row: any) => row.doc)
      .filter(
        (doc: any) =>
          doc && 
          !doc._deleted && 
          doc.type === "person"
      );
    
    // Return only the latest version of each person (by connectionNumber within area)
    const latestMap = new Map();
    
    for (const person of allPersons) {
      const key = `${person.areaId}_${person.connectionNumber}`;
      const existing = latestMap.get(key);
      
      if (!existing) {
        latestMap.set(key, person);
      } else {
        const existingDate = new Date(existing.updatedAt || existing.createdAt || 0);
        const newDate = new Date(person.updatedAt || person.createdAt || 0);
        if (newDate > existingDate) {
          latestMap.set(key, person);
        }
      }
    }
    
    return Array.from(latestMap.values());
  };

  const getAllDefaulters = async () => {
    const allPersons = await getAllPersons();
    return allPersons.filter((doc: any) => doc.status === "defaulter");
  };

  const totalConnections = async () => {
    const persons = await getAllPersons();
    return persons.filter((p: any) => p.status === "active").length;
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

  // Balance calculation
  const calculateCustomerBalance = async (personId: string) => {
    try {
      const res = await localDB.allDocs({ include_docs: true });
      const docs = res.rows
        .map((r: any) => r.doc)
        .filter((d: any) => d && !d._deleted && d.personId === personId);

      const person = docs.find((d: any) => d.type === "person");
      if (!person) return 0;

      // Use stored currentBalance if available
      if (person.currentBalance !== undefined) {
        return person.currentBalance;
      }

      const monthlyFee = Number(person.amount || 0);
      const connectionDate = new Date(person.createdAt);
      const currentDate = new Date();
      
      let expectedTotalFees = 0;
      
      const connectionDay = connectionDate.getDate();
      let feeDate;
      
      if (connectionDay > 15) {
        feeDate = new Date(connectionDate.getFullYear(), connectionDate.getMonth() + 1, 1);
      } else {
        feeDate = new Date(connectionDate.getFullYear(), connectionDate.getMonth(), 1);
      }
      
      const today = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      
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

  // Update person's balance
  const updatePersonBalance = async (personId: string, amountChange: number) => {
    try {
      const person = await localDB.get(personId);
      const newBalance = (person.currentBalance || 0) + amountChange;
      const updatedPerson = {
        ...person,
        currentBalance: newBalance,
        updatedAt: new Date().toISOString(),
      };
      await localDB.put(updatedPerson);
      return newBalance;
    } catch (err) {
      console.error("Failed to update balance:", err);
      return null;
    }
  };

  const getPersonBalance = async (personId: string) => {
    try {
      const person = await localDB.get(personId);
      return person.currentBalance || 0;
    } catch (err) {
      return 0;
    }
  };
const safeNumber = (value: any) => Number(value || 0);

const recalculateAndUpdatePersonBalance = async (personId: string) => {
  const ledger = await getCustomerLedger(personId);
  const person: any = await localDB.get(personId);

  await localDB.put({
    ...person,
    currentBalance: ledger.balance,
    remainingBalance: ledger.balance > 0 ? ledger.balance : 0,
    advanceBalance: ledger.balance < 0 ? Math.abs(ledger.balance) : 0,
    updatedAt: new Date().toISOString(),
  });

  return ledger.balance;
};

const createCustomerDebit = async (data: any) => {
  const person: any = await localDB.get(data.personId);
  const now = new Date().toISOString();

  const doc: any = {
    _id: `customer_debit_${data.personId}_${Date.now()}`,
    type: "customer-debit",
    areaId: person.areaId,
    personId: person._id,
    connectionNumber: person.connectionNumber,
    personName: person.name,
    personAddress: person.address || "-",
    receiptNo: data.receiptNo || "",
    description: data.description || "Customer Debit",
    amount: safeNumber(data.amount),
    date: now.slice(0, 10),
    month: now.slice(0, 7),
    createdAt: now,
  };

  await localDB.put(doc);
  const balance = await recalculateAndUpdatePersonBalance(person._id);

  return { debit: doc, balance };
};

const createCreditNote = async (data: any) => {
  const person: any = await localDB.get(data.personId);
  const now = new Date().toISOString();

  const doc: any = {
    _id: `credit_note_${data.personId}_${Date.now()}`,
    type: "credit-note",
    areaId: person.areaId,
    personId: person._id,
    connectionNumber: person.connectionNumber,
    personName: person.name,
    personAddress: person.address || "-",
    receiptNo: data.receiptNo || "",
    description: data.description || "Credit Note",
    amount: safeNumber(data.amount),
    date: now.slice(0, 10),
    month: now.slice(0, 7),
    createdAt: now,
  };

  await localDB.put(doc);
  const balance = await recalculateAndUpdatePersonBalance(person._id);

  return { creditNote: doc, balance };
};

const getCustomerLedger = async (personId: string) => {
  const res = await localDB.allDocs({ include_docs: true });

  const docs = res.rows
    .map((r: any) => r.doc)
    .filter(
      (d: any) =>
        d &&
        !d._deleted &&
        d.personId === personId &&
        ["customer-debit", "payment", "credit-note"].includes(d.type),
    );

  const sorted = docs.sort((a: any, b: any) => {
    const aTime = new Date(a.createdAt || a.date || 0).getTime();
    const bTime = new Date(b.createdAt || b.date || 0).getTime();
    return aTime - bTime;
  });

  let runningBalance = 0;

  const transactions = sorted.map((doc: any) => {
    let sale = 0;
    let payment = 0;

    if (doc.type === "customer-debit") {
      sale = safeNumber(doc.amount);
      runningBalance += sale;
    }

    if (doc.type === "payment" || doc.type === "credit-note") {
      payment = safeNumber(doc.amount);
      runningBalance -= payment;
    }

    return {
      id: doc._id,
      date: doc.date || String(doc.createdAt || "").slice(0, 10),
      description: doc.description || "-",
      sale,
      payment,
      balance: runningBalance,
      type: doc.type,
    };
  });

  return {
    transactions,
    balance: runningBalance,
  };
};
  return {
    localDB,
    remoteDB,
    createCashReceivedRecord,
    createCustomerDebit,
createCreditNote,
getCustomerLedger,
recalculateAndUpdatePersonBalance,
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
    updatePersonBalance,
    getPersonBalance,
  };
};