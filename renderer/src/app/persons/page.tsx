"use client";

import React, { useEffect, useRef, useState } from "react";
import { initDB } from "../services/db";

export default function PersonsPage() {
  const [db, setDb] = useState<any>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const [selectedArea, setSelectedArea] = useState("");
  const [persons, setPersons] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [feeList, setFeeList] = useState<any[]>([]);
  const [personName, setPersonName] = useState("");
  const [personConnectionNumber, setPersonConnectionNumber] = useState("");
  const [personAddress, setPersonAddress] = useState("");
  const [personReceiptNo, setPersonReceiptNo] = useState("");
  const [monthlyFee, setMonthlyFee] = useState<number | "">("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [editingPerson, setEditingPerson] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Refs for form inputs - for keyboard navigation
  const connectionRef = useRef<HTMLInputElement>(null);
  const receiptNoRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const feeRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const setupDB = async () => {
      const pouch = await initDB();
      if (pouch) {
        pouch.syncDB();
        setDb(pouch);
        const fees = await pouch.getFeeList();
        setFeeList(fees);
        const allAreas = await pouch.getAreas();
        setAreas(allAreas);
        setLoading(false);
      }
    };
    setupDB();
  }, []);

  // ─── Auto-increment connection number when area changes ───────────────────
  const getNextConnectionNumber = (areaPersons: any[]): string => {
    if (!areaPersons || areaPersons.length === 0) return "1";

    const maxNum = areaPersons.reduce((max: number, p: any) => {
      const num = parseInt(p.connectionNumber, 10);
      return !isNaN(num) && num > max ? num : max;
    }, 0);

    return String(maxNum + 1);
  };

  const loadPersons = async (areaId: string) => {
    if (!db) return;
    setSelectedArea(areaId);
    setSearchTerm("");
    const allPersons = await db.getPersonsByArea(areaId);
    setPersons(allPersons);

    // Auto-fill next connection number for the selected area
    if (!isEditing) {
      setPersonConnectionNumber(getNextConnectionNumber(allPersons));
    }
  };

  const filteredPersons = persons.filter((person) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      person.name?.toLowerCase().includes(term) ||
      person.connectionNumber?.toLowerCase().includes(term) ||
      person.address?.toLowerCase().includes(term)
    );
  });

  const handleClearSearch = () => {
    setSearchTerm("");
  };

  const addPerson = async () => {
    if (!db) return;

    let areaId = selectedArea;
    if (!areaId) {
      alert("Please select an area for the person");
      return;
    }
    if (!personName.trim()) {
      alert("Please enter person name");
      return;
    }
    if (!personConnectionNumber.trim()) {
      alert("Please enter a connection number for the person");
      return;
    }
    if (!personReceiptNo.trim()) {
      alert("Please enter a receipt number for the person");
      return;
    }
    if (!personAddress.trim()) {
      alert("Please enter person address");
      return;
    }
    if (monthlyFee === "" || Number.isNaN(Number(monthlyFee))) {
      alert("Please enter monthly fee");
      return;
    }

    try {
      await db.createPerson(
        personName,
        areaId,
        personConnectionNumber.trim(),
        Number(monthlyFee),
        personAddress.trim(),
        0, // amountPaid defaults to 0
        Number(monthlyFee), // remainingBalance = full monthly fee
        personReceiptNo.trim(),
        phoneNumber.trim(),
      );

      const allPersons = await db.getPersonsByArea(areaId);
      setPersons(allPersons);

      // Reset form but pre-fill next connection number
      setPersonName("");
      setMonthlyFee("");
      setPersonConnectionNumber(getNextConnectionNumber(allPersons));
      setPersonAddress("");
      setPersonReceiptNo("");
      setPhoneNumber("");
    } catch (err: any) {
      alert(err?.message || "Failed to add person");
    }
  };

  // ─── Edit helpers ─────────────────────────────────────────────────────────
  const startEditPerson = (person: any) => {
    setEditingPerson(person);
    setIsEditing(true);

    setPersonName(person.name || "");
    setPersonConnectionNumber(person.connectionNumber || "");
    setPersonReceiptNo(person.receiptNo || "");
    setPersonAddress(person.address || "");
    setMonthlyFee(person.amount ?? "");
    setPhoneNumber(person.phoneNumber || "");
  };

  const resetForm = async () => {
    setEditingPerson(null);
    setIsEditing(false);
    setPersonName("");
    setPersonReceiptNo("");
    setPersonAddress("");
    setMonthlyFee("");
    setPhoneNumber("");

    // Re-compute next connection number after cancelling edit
    if (selectedArea && db) {
      const allPersons = await db.getPersonsByArea(selectedArea);
      setPersonConnectionNumber(getNextConnectionNumber(allPersons));
    } else {
      setPersonConnectionNumber("");
    }
  };

  const cancelEdit = () => resetForm();

  const updateExistingPerson = async () => {
    if (!db || !editingPerson) return;

    if (!selectedArea) {
      alert("Please select an area for the person");
      return;
    }
    if (!personName.trim()) {
      alert("Please enter person name");
      return;
    }
    if (!personConnectionNumber.trim()) {
      alert("Please enter a connection number");
      return;
    }
    if (!personReceiptNo.trim()) {
      alert("Please enter a receipt number");
      return;
    }
    if (!personAddress.trim()) {
      alert("Please enter person address");
      return;
    }
    if (monthlyFee === "" || Number.isNaN(Number(monthlyFee))) {
      alert("Please enter monthly fee");
      return;
    }

    const newMonthlyFee = Number(monthlyFee);

    try {
      await db.updatePerson(editingPerson, {
        name: personName.trim(),
        connectionNumber: personConnectionNumber.trim(),
        receiptNo: personReceiptNo.trim(),
        address: personAddress.trim(),
        amount: newMonthlyFee,
        remainingBalance: newMonthlyFee,
        phoneNumber: phoneNumber.trim(),
        areaId: selectedArea,
      });

      const allPersons = await db.getPersonsByArea(selectedArea);
      setPersons(allPersons);

      resetForm();
      alert("Person updated successfully");
    } catch (err: any) {
      alert(err?.message || "Failed to update person");
    }
  };

  // ─── Keyboard navigation ──────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent, nextRef?: any) => {
    if ((e.key === "Tab" || e.key === "Enter") && !e.shiftKey && nextRef) {
      e.preventDefault();
      nextRef.current?.focus();
    }
  };

  // ─── CRUD helpers ─────────────────────────────────────────────────────────
  const deletePerson = async (person: any) => {
    if (!db) return;
    await db.deletePerson(person);
    const allPersons = await db.getPersonsByArea(selectedArea);
    setPersons(allPersons);
    if (!isEditing)
      setPersonConnectionNumber(getNextConnectionNumber(allPersons));
  };

  const disconnectPerson = async (person: any) => {
    if (!db) return;
    if (
      !confirm(
        `Disconnect ${person.name} (Conn #${person.connectionNumber || "unknown"})? They will be moved to the Disconnection List.`,
      )
    )
      return;
    try {
      await db.moveToDisconnected(person);
      const allPersons = await db.getPersonsByArea(selectedArea);
      setPersons(allPersons);
      alert("Connection disconnected successfully.");
    } catch (err: any) {
      alert("Failed to disconnect: " + (err?.message || "Unknown error"));
    }
  };

  const moveToDefaulterList = async (person: any) => {
    if (!db) return;
    if (
      !confirm(
        `Move ${person.name} (Conn #${person.connectionNumber || "unknown"}) to the defaulter list?`,
      )
    )
      return;
    try {
      await db.moveTodefalterList(person);
      const allPersons = await db.getPersonsByArea(selectedArea);
      setPersons(allPersons);
      alert("Person moved to defaulter list successfully.");
    } catch (err: any) {
      alert("Failed to move person: " + (err?.message || "Unknown error"));
    }
  };

  // ─── Print receipt ────────────────────────────────────────────────────────
  const printReceipt = () => {
    if (
      !personName.trim() ||
      !personConnectionNumber.trim() ||
      !personReceiptNo.trim() ||
      !personAddress.trim() ||
      monthlyFee === ""
    ) {
      alert("Please fill all person details before printing receipt");
      return;
    }
    if (!selectedArea) {
      alert("Please select an area");
      return;
    }

    const selectedAreaName =
      areas.find((a) => a._id === selectedArea)?.name || "";
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) {
      alert("Please allow pop-ups to print receipt");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Person Registration Receipt</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #fff; }
          .receipt-container { max-width: 400px; margin: 0 auto; border: 2px solid #333; border-radius: 10px; padding: 25px; }
          .urdu-header, .urdu-names { text-align: center; direction: rtl; margin-bottom: 10px; }
          .urdu-header h2 { margin: 0; font-size: 24px; }
          .urdu-names h3 { margin: 0; font-size: 20px; }
          .urdu-names .ceo-title { color: #666; font-size: 16px; }
          .urdu-names .owner-name { font-size: 18px; font-weight: bold; margin-top: 8px; }
          .header { text-align: center; border-bottom: 3px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
          .date { text-align: right; margin-bottom: 15px; color: #666; font-size: 12px; }
          .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dashed #ddd; }
          .label { font-weight: bold; color: #555; min-width: 150px; }
          .value { color: #333; text-align: right; }
          .total-row { display: flex; justify-content: space-between; margin-top: 20px; padding-top: 15px; border-top: 2px solid #333; font-size: 18px; font-weight: bold; }
          .footer { text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
          .thank-you { text-align: center; margin-top: 20px; font-style: italic; color: #555; }
          @media print { body { margin: 0; padding: 0; } .receipt-container { border: none; } }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="urdu-header"><h2>فیملی کیبل نیٹ ورک</h2></div>
          <div class="urdu-names">
            <h3>خالد محمود خان</h3>
            <div class="ceo-title">CEO's</div>
            <div class="owner-name">سید محمد رضا شاہ</div>
          </div>
          <div class="date">Date: ${new Date().toLocaleDateString()}<br>Time: ${new Date().toLocaleTimeString()}</div>
          <div class="receipt-details">
            <div class="detail-row"><span class="label">Receipt No:</span><span class="value">${personReceiptNo}</span></div>
            <div class="detail-row"><span class="label">Connection #:</span><span class="value">${personConnectionNumber}</span></div>
            <div class="detail-row"><span class="label">Person Name:</span><span class="value">${personName}</span></div>
            <div class="detail-row"><span class="label">Area:</span><span class="value">${selectedAreaName}</span></div>
            <div class="detail-row"><span class="label">Address:</span><span class="value">${personAddress}</span></div>
            ${phoneNumber ? `<div class="detail-row"><span class="label">Phone:</span><span class="value">${phoneNumber}</span></div>` : ""}
            <div class="detail-row"><span class="label">Monthly Fee:</span><span class="value">Rs.${Number(monthlyFee).toFixed(2)}</span></div>
            <div class="total-row"><span>Balance Due:</span><span>Rs.${Number(monthlyFee).toFixed(2)}</span></div>
          </div>
          <div class="thank-you">Thank you for registering!</div>
          <div class="footer">
            <p>This is a computer generated receipt</p>
            <p>No signature required</p>
            <p>Please keep this receipt for future reference</p>
          </div>
        </div>
        <script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 1000); };</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // ─── Print persons list ───────────────────────────────────────────────────
  const printPersonsList = () => {
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) {
      alert("Please allow pop-ups to print the persons list");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Persons List</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
          .urdu-header { text-align: center; margin-bottom: 15px; direction: rtl; }
          .urdu-header h2 { margin: 0; color: #333; font-size: 24px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f4f4f4; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="urdu-header"><h2>فیملی کیبل نیٹ ورک</h2></div>
        <table>
          <thead>
            <tr>
              <th>Receipt No</th><th>Conn #</th><th>Person Name</th>
              <th>Address</th><th>Phone</th><th>Monthly Fee</th>
              <th>Pending Amount</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${persons
              .map(
                (person) => `
              <tr>
                <td>${person.receiptNo ?? "-"}</td>
                <td>${person.connectionNumber ?? "-"}</td>
                <td>${person.name}</td>
                <td>${person.address && person.address !== "-" ? person.address : "-"}</td>
                <td>${person.phoneNumber || "-"}</td>
                <td>Rs.${person.amount !== undefined ? Number(person.amount).toFixed(2) : "0.00"}</td>
                <td style="color: ${Number(person.remainingBalance || 0) > 0 ? "#dc2626" : "#6b7280"}; font-weight: bold;">
                  Rs.${Number(person.remainingBalance || 0).toFixed(2)}
                </td>
                <td>Active</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
        <script>window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 1000); };</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-lg text-gray-600">Loading Database...</div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div ref={receiptRef} className="hidden"></div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Persons Management
        </h1>
        <p className="text-gray-600">
          Add and manage persons in different areas
        </p>
      </div>

      {/* Area Selection */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Select Area
        </h2>
        <select
          value={selectedArea}
          onChange={(e) => loadPersons(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
        >
          <option value="">-- Select Area --</option>
          {areas.map((area) => (
            <option key={area._id} value={area._id}>
              {area.name}
            </option>
          ))}
        </select>
      </div>

      {/* Add / Edit Person Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">
          {isEditing ? "Edit Person" : "Add New Person"}
        </h2>

        {/* Row 1: Connection #, Receipt No, Person Name */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Person Connection #
              <span className="ml-1 text-xs text-blue-500 font-normal">
                (auto-filled)
              </span>
            </label>
            <input
              ref={connectionRef}
              type="text"
              value={personConnectionNumber}
              onChange={(e) => setPersonConnectionNumber(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, receiptNoRef)}
              placeholder="Connection number"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-500 bg-blue-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Receipt No <span className="text-red-500">*</span>
            </label>
            <input
              ref={receiptNoRef}
              type="text"
              value={personReceiptNo}
              onChange={(e) => setPersonReceiptNo(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, nameRef)}
              placeholder="Enter receipt number"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Person Name
            </label>
            <input
              ref={nameRef}
              type="text"
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, addressRef)}
              placeholder="Enter person name..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-500"
            />
          </div>
        </div>

        {/* Row 2: Address, Monthly Fee, Phone Number */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Address
            </label>
            <input
              ref={addressRef}
              type="text"
              value={personAddress}
              onChange={(e) => setPersonAddress(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, feeRef)}
              placeholder="Enter address..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monthly Fee
            </label>
            <select
              ref={feeRef as any}
              value={monthlyFee === "" ? "" : monthlyFee}
              onChange={(e) =>
                setMonthlyFee(
                  e.target.value === "" ? "" : Number(e.target.value),
                )
              }
              onKeyDown={(e) => handleKeyDown(e, phoneRef)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 bg-white"
            >
              <option value="">-- Select Fee --</option>
              {feeList.map((fee) => (
                <option key={fee._id} value={fee.amount}>
                  {fee.description} — Rs.{Number(fee.amount).toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <input
              ref={phoneRef}
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  isEditing ? updateExistingPerson() : addPerson();
                }
              }}
              placeholder="Enter phone number"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-500"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-4">
          <button
            onClick={isEditing ? updateExistingPerson : addPerson}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-700 text-white rounded-lg hover:from-blue-700 hover:to-purple-800 transition-colors duration-200 font-medium"
          >
            {isEditing ? "Update Person" : "Add Person"}
          </button>

          {isEditing && (
            <button
              onClick={cancelEdit}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200 font-medium"
            >
              Cancel
            </button>
          )}

          <button
            onClick={printReceipt}
            className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-700 text-white rounded-lg hover:from-green-700 hover:to-emerald-800 transition-colors duration-200 font-medium"
          >
            Print Receipt
          </button>
        </div>
      </div>

      {/* Persons List */}
      {selectedArea && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">
              Persons in Selected Area
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {filteredPersons.length} person(s) found
            </p>

            <div className="mt-4 flex flex-col md:flex-row gap-3">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, connection number, or address"
                className="w-full md:w-96 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-500"
              />
              <button
                onClick={handleClearSearch}
                className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200 font-medium"
              >
                Clear
              </button>
            </div>
          </div>

          {persons.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-gray-400 text-lg mb-2">
                No persons found in this area
              </div>
              <p className="text-gray-500">
                Add your first person using the form above
              </p>
            </div>
          ) : filteredPersons.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-gray-400 text-lg mb-2">
                No matching person found
              </div>
              <p className="text-gray-500">
                Try another name, connection number, or address
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {[
                      "Receipt No",
                      "Conn #",
                      "Person Name",
                      "Address",
                      "Phone",
                      "Monthly Fee",
                      "Pending Amount",
                      "Status",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPersons.map((person) => (
                    <tr
                      key={person._id}
                      className="hover:bg-gray-50 transition-colors duration-150"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-blue-700">
                          {person.receiptNo ?? "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {person.connectionNumber ?? "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {person.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {person.address && person.address !== "-"
                            ? person.address
                            : "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {person.phoneNumber || "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {person.amount
                            ? `Rs.${Number(person.amount).toFixed(2)}`
                            : "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div
                          className={`text-sm font-medium ${Number(person.remainingBalance || 0) > 0 ? "text-red-600" : "text-gray-500"}`}
                        >
                          Rs.{Number(person.remainingBalance || 0).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex gap-2 flex-wrap">
                        <button
                          onClick={() => startEditPerson(person)}
                          className="text-blue-600 hover:text-blue-900 hover:bg-blue-50 px-3 py-1 rounded-md transition-colors duration-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => disconnectPerson(person)}
                          className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-3 py-1 rounded-md transition-colors duration-200 border border-gray-300"
                        >
                          Disconnect
                        </button>
                        <button
                          onClick={() => moveToDefaulterList(person)}
                          className="text-orange-600 hover:text-orange-900 hover:bg-orange-50 px-3 py-1 rounded-md transition-colors duration-200"
                        >
                          Move to Defaulter
                        </button>
                        <button
                          onClick={() => deletePerson(person)}
                          className="text-red-600 hover:text-red-900 hover:bg-red-50 px-3 py-1 rounded-md transition-colors duration-200"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Print List button */}
      {selectedArea && persons.length > 0 && (
        <div className="mt-4">
          <button
            onClick={printPersonsList}
            className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-700 text-white rounded-lg hover:from-green-700 hover:to-emerald-800 transition-colors duration-200 font-medium"
          >
            Print List
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Persons</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {persons.length}
              </p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-100 text-blue-800">
              Area
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            All persons in selected area
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Areas</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {areas.length}
              </p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-green-100 text-green-800">
              {areas.length > 0 ? "Ready" : "None"}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-4">Total areas available</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600">Selected Area</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {selectedArea
                  ? areas.find((a) => a._id === selectedArea)?.name
                  : "None"}
              </p>
            </div>
            <span
              className={`text-xs font-semibold px-2 py-1 rounded ${selectedArea ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-800"}`}
            >
              {selectedArea ? "✓" : "✗"}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            {selectedArea ? "Area selected" : "No area selected"}
          </p>
        </div>
      </div>
    </div>
  );
}
