"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { initDB } from "../services/db";

export default function InternetEntryPage() {
  const router = useRouter();
  const [db, setDb] = useState<any>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const [selectedArea, setSelectedArea] = useState("");
  const [entries, setEntries] = useState<any[]>([]);
  
  // Form fields
  const [entryName, setEntryName] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [cnic, setCnic] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [connectionNumber, setConnectionNumber] = useState("");
  const [routerNo, setRouterNo] = useState("");
  const [monthlyFee, setMonthlyFee] = useState<number | ''>('');
  const [pendingAmount, setPendingAmount] = useState<number | ''>('');
  const [installationFee, setInstallationFee] = useState<number | ''>('');
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const setupDB = async () => {
      const pouch = await initDB();
      if (pouch) {
        pouch.syncDB();
        setDb(pouch);
        const allAreas = await pouch.getAreas();
        setAreas(allAreas);
        setLoading(false);
      }
    };
    setupDB();
  }, []);

  const loadEntries = async (areaId: string) => {
    if (!db) return;
    setSelectedArea(areaId);
    const allEntries = await db.getInternetEntriesByArea(areaId);
    setEntries(allEntries);
  };

  const addEntry = async () => {
    if (!db) return;

    let areaId = selectedArea;
    if (!areaId) {
      alert('Please select an area');
      return;
    }

    if (!entryName.trim()) {
      alert('Please enter name');
      return;
    }

    if (!fatherName.trim()) {
      alert('Please enter father name');
      return;
    }

    if (!cnic.trim()) {
      alert('Please enter CNIC');
      return;
    }

    if (!phone.trim()) {
      alert('Please enter phone number');
      return;
    }

    if (!address.trim()) {
      alert('Please enter address');
      return;
    }

    try {
      await db.createInternetEntry(
        entryName.trim(),
        fatherName.trim(),
        cnic.trim(),
        phone.trim(),
        address.trim(),
        areaId,
        connectionNumber.trim() || undefined,
        routerNo.trim() || undefined,
        monthlyFee === '' ? undefined : Number(monthlyFee),
        installationFee === '' ? undefined : Number(installationFee),
        pendingAmount === '' ? undefined : Number(pendingAmount)
      );
      
      const allEntries = await db.getInternetEntriesByArea(areaId);
      setEntries(allEntries);
      
      // Clear form
      setEntryName("");
      setFatherName("");
      setCnic("");
      setPhone("");
      setAddress("");
      setConnectionNumber("");
      setRouterNo("");
      setPendingAmount("");
      setMonthlyFee('');
      setInstallationFee('');
      
      alert('Internet entry added successfully');
    } catch (err: any) {
      alert(err?.message || 'Failed to add entry');
    }
  };

  const deleteEntry = async (entry: any) => {
    if (!db) return;
    try {
      await db.deleteInternetEntry(entry);
      const allEntries = await db.getInternetEntriesByArea(selectedArea);
      setEntries(allEntries);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete entry');
    }
  };

  const printReceipt = () => {
    if (!entryName.trim() || !fatherName.trim() || !cnic.trim() || !phone.trim() || !address.trim()) {
      alert('Please fill all required details before printing receipt');
      return;
    }

    if (!selectedArea) {
      alert('Please select an area');
      return;
    }

    const selectedAreaName = areas.find(a => a._id === selectedArea)?.name || '';
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to print receipt');
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Internet Entry Receipt</title>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #fff;
          }
          .receipt-container {
            max-width: 400px;
            margin: 0 auto;
            border: 2px solid #333;
            border-radius: 10px;
            padding: 25px;
            background-color: #fff;
          }
          .urdu-header {
            text-align: center;
            margin-bottom: 15px;
            direction: rtl;
          }
          .urdu-header h2 {
            margin: 0;
            color: #333;
            font-size: 24px;
            font-weight: bold;
          }
          .urdu-names {
            text-align: center;
            margin-bottom: 20px;
            direction: rtl;
          }
          .urdu-names h3 {
            margin: 0;
            color: #222;
            font-size: 20px;
            font-weight: bold;
          }
          .urdu-names .ceo-title {
            color: #666;
            font-size: 16px;
            margin: 5px 0;
            font-weight: normal;
          }
          .urdu-names .owner-name {
            color: #222;
            font-size: 18px;
            font-weight: bold;
            margin-top: 10px;
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #333;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .header h1 {
            margin: 0;
            color: #333;
            font-size: 28px;
            font-weight: bold;
          }
          .header p {
            margin: 5px 0 0 0;
            color: #666;
            font-size: 14px;
          }
          .receipt-details {
            margin-bottom: 25px;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 1px dashed #ddd;
          }
          .label {
            font-weight: bold;
            color: #555;
            min-width: 150px;
          }
          .value {
            color: #333;
            text-align: right;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin-top: 20px;
            padding-top: 15px;
            border-top: 2px solid #333;
            font-size: 18px;
            font-weight: bold;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 12px;
          }
          .date {
            text-align: right;
            margin-bottom: 15px;
            color: #666;
            font-size: 12px;
          }
          .thank-you {
            text-align: center;
            margin-top: 20px;
            font-style: italic;
            color: #555;
          }
          @media print {
            body {
              margin: 0;
              padding: 0;
            }
            .receipt-container {
              border: none;
              box-shadow: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <!-- Urdu Header -->
          <div class="urdu-header">
            <h2>فیملی کیبل نیٹ ورک</h2>
          </div>
          
          <!-- Urdu Names Section -->
          <div class="urdu-names">
            <h3>خالد محمود خان</h3>
            <div class="ceo-title">CEO's</div>
            <div class="owner-name">سید محمد رضا شاہ</div>
          </div>

          <div class="date">
            Date: ${new Date().toLocaleDateString()}<br>
            Time: ${new Date().toLocaleTimeString()}
          </div>
          
          <div class="receipt-details">
            <div class="detail-row">
              <span class="label">Receipt No:</span>
              <span class="value">${cnic.slice(-4)}-${Date.now().toString().slice(-6)}</span>
            </div>
            <div class="detail-row">
              <span class="label">Customer Name:</span>
              <span class="value">${entryName}</span>
            </div>
            <div class="detail-row">
              <span class="label">Father Name:</span>
              <span class="value">${fatherName}</span>
            </div>
            <div class="detail-row">
              <span class="label">CNIC:</span>
              <span class="value">${cnic}</span>
            </div>
            <div class="detail-row">
              <span class="label">Phone:</span>
              <span class="value">${phone}</span>
            </div>
            <div class="detail-row">
              <span class="label">Area:</span>
              <span class="value">${selectedAreaName}</span>
            </div>
            <div class="detail-row">
              <span class="label">Address:</span>
              <span class="value">${address}</span>
            </div>
            <div class="detail-row">
              <span class="label">Connection #:</span>
              <span class="value">${connectionNumber || '-'}</span>
            </div>
            <div class="detail-row">
              <span class="label">Router No:</span>
              <span class="value">${routerNo || '-'}</span>
            </div>
            <div class="detail-row">
              <span class="label">Monthly Fee:</span>
              <span class="value">Rs.${monthlyFee === '' ? '0.00' : Number(monthlyFee).toFixed(2)}</span>
            </div>
            <div class="detail-row">
              <span class="label">Installation Fee:</span>
              <span class="value">Rs.${installationFee === '' ? '0.00' : Number(installationFee).toFixed(2)}</span>
            </div>
            <div class="detail-row">
              <span class="label">Pending Amount:</span>
              <span class="value">Rs.${pendingAmount === '' ? '0.00' : Number(pendingAmount).toFixed(2)}</span>
            </div>
          </div>
          
          <div class="total-row">
            <span>Total Charges:</span>
            <span>Rs.${((monthlyFee === '' ? 0 : Number(monthlyFee)) + (installationFee === '' ? 0 : Number(installationFee))).toFixed(2)}</span>
          </div>
          
          <div class="thank-you">
            Thank you for registering with us!
          </div>
          
          <div class="footer">
            <p>This is a computer generated receipt</p>
            <p>No signature required</p>
            <p>Please keep this receipt for future reference</p>
          </div>
        </div>
        
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() {
              window.close();
            }, 1000);
          };
        </script>
      </body>
      </html>
    `);
    
    printWindow.document.close();
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-lg text-gray-600">Loading Database...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Internet Entry Management</h1>
        <p className="text-gray-600">Add and manage internet customer entries</p>
      </div>

      {/* Area Selection Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Select Area</h2>
        <div className="flex gap-4 items-center">
          <select
            value={selectedArea}
            onChange={(e) => loadEntries(e.target.value)}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
          >
            <option value="">-- Select Area --</option>
            {areas.map((area) => (
              <option key={area._id} value={area._id}>
                {area.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Add Internet Entry Form Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">Add New Internet Entry</h2>
        
        {/* First row: Name and Father Name */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
            <input
              type="text"
              value={entryName}
              onChange={(e) => setEntryName(e.target.value)}
              placeholder="Enter name..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Father Name</label>
            <input
              type="text"
              value={fatherName}
              onChange={(e) => setFatherName(e.target.value)}
              placeholder="Enter father name..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-500"
            />
          </div>
        </div>

        {/* Second row: CNIC and Phone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">CNIC</label>
            <input
              type="text"
              value={cnic}
              onChange={(e) => setCnic(e.target.value)}
              placeholder="Enter CNIC..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter phone number..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-500"
            />
          </div>
        </div>

        {/* Third row: Address */}
        <div className="grid grid-cols-1 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter address..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-500"
            />
          </div>
        </div>

        {/* Fourth row: Connection Number, Router No, Monthly Fee, Installation Fee */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Connection Number (Optional)</label>
            <input
              type="text"
              value={connectionNumber}
              onChange={(e) => setConnectionNumber(e.target.value)}
              placeholder="Enter connection number..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Router No (Optional)</label>
            <input
              type="text"
              value={routerNo}
              onChange={(e) => setRouterNo(e.target.value)}
              placeholder="Enter router number..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Fee (Optional)</label>
            <input
              type="number"
              value={monthlyFee === '' ? '' : monthlyFee}
              onChange={(e) => setMonthlyFee(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Enter monthly fee..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Installation Fee (Optional)</label>
            <input
              type="number"
              value={installationFee === '' ? '' : installationFee}
              onChange={(e) => setInstallationFee(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Enter installation fee..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Pending Amount (Optional)</label>
            <input
              type="number"
              value={pendingAmount === '' ? '' : pendingAmount}
              onChange={(e) => setPendingAmount(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Enter pending amount..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-500"
            />
          </div>
        </div>

        {/* Button */}
        <div className="flex gap-4">
          <button
            onClick={addEntry}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-700 text-white rounded-lg hover:from-blue-700 hover:to-purple-800 transition-colors duration-200 font-medium"
          >
            Add Entry
          </button>
          
          <button
            onClick={printReceipt}
            className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-700 text-white rounded-lg hover:from-green-700 hover:to-emerald-800 transition-colors duration-200 font-medium"
          >
            Print Receipt
          </button>
          
          <button
            onClick={() => router.push('/find-internet-record')}
            className="px-6 py-3 bg-gradient-to-r from-orange-600 to-red-700 text-white rounded-lg hover:from-orange-700 hover:to-red-800 transition-colors duration-200 font-medium"
          >
            Find Records
          </button>
        </div>
      </div>

      {/* Entries List Card */}
      {selectedArea && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">Internet Entries in Selected Area</h2>
            <p className="text-sm text-gray-500 mt-1">{entries.length} entry/entries found</p>
          </div>

          {entries.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-gray-400 text-lg mb-2">No internet entries found in this area</div>
              <p className="text-gray-500">Add your first entry using the form above</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Father Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      CNIC
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Connection #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Router No
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Monthly Fee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Installation Fee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pending Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {entries.map((entry) => (
                    <tr key={entry._id} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{entry.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{entry.fatherName || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{entry.cnic || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{entry.phone || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{entry.address || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{entry.connectionNumber || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{entry.routerNo || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {entry.monthlyFee ? `Rs.${Number(entry.monthlyFee).toFixed(2)}` : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {entry.installationFee ? `Rs.${Number(entry.installationFee).toFixed(2)}` : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{entry.pendingAmount ? `Rs.${Number(entry.pendingAmount).toFixed(2)}` : '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button 
                          onClick={() => deleteEntry(entry)}
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Entries</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{entries.length}</p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-100 text-blue-800">
              +0%
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-4">All entries in selected area</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Areas</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{areas.length}</p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-green-100 text-green-800">
              {areas.length > 0 ? 'Ready' : 'None'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-4">Total areas available</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-600">Selected Area</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {selectedArea ? areas.find(a => a._id === selectedArea)?.name : 'None'}
              </p>
            </div>
            <span className={`text-xs font-semibold px-2 py-1 rounded ${
              selectedArea ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {selectedArea ? '✓' : '✗'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            {selectedArea ? 'Area selected' : 'No area selected'}
          </p>
        </div>
      </div>
    </div>
  );
}
