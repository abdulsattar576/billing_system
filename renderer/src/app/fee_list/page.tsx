"use client";

import { useEffect, useState } from "react";
import { initDB } from "../services/db";

export default function FeeListPage() {
  const [db, setDb] = useState<any>(null);
  const [fees, setFees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [editingFee, setEditingFee] = useState<any>(null);

  useEffect(() => {
    const setup = async () => {
      const pouch = await initDB();
      if (!pouch) return;

      setDb(pouch);
      await loadFees(pouch);
      setLoading(false);
    };

    setup();
  }, []);

  // ✅ LOAD FEES (FIXED)
  const loadFees = async (pouch: any) => {
    const data = await pouch.getFeeList();
    setFees(data);
  };

  const resetForm = () => {
    setDescription("");
    setAmount("");
    setEditingFee(null);
  };

  // ✅ CREATE / UPDATE
  const handleSubmit = async () => {
    if (!db) return;

    if (!description || amount === "") {
      alert("Description & Amount required");
      return;
    }

    try {
      if (editingFee) {
        await db.updateFeeList(editingFee, {
          description,
          amount: Number(amount),
        });
      } else {
        await db.createFeeList(description, Number(amount));
      }

      await loadFees(db);
      resetForm();
    } catch (err: any) {
      alert(err.message || "Error saving fee");
    }
  };

  const handleEdit = (fee: any) => {
    setEditingFee(fee);
    setDescription(fee.description);
    setAmount(fee.amount);
  };

  const handleDelete = async (fee: any) => {
    if (!db) return;
    if (!confirm("Delete this fee?")) return;

    await db.deleteFeeList(fee);
    await loadFees(db);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Fee List Manager</h1>

      {/* FORM */}
      <div className="bg-white p-4 rounded-xl shadow mb-6">
        <input
          className="border p-2 w-full mb-2"
          placeholder="Description (e.g. Monthly Internet Fee)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <input
          type="number"
          className="border p-2 w-full mb-2"
          placeholder="Amount"
          value={amount}
          onChange={(e) =>
            setAmount(e.target.value === "" ? "" : Number(e.target.value))
          }
        />

        <button
          onClick={handleSubmit}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {editingFee ? "Update Fee" : "Add Fee"}
        </button>
      </div>

      {/* LIST */}
      <div className="grid gap-3">
        {fees.map((fee) => (
          <div
            key={fee._id}
            className="bg-white p-4 rounded-xl shadow flex justify-between"
          >
            <div>
              <div className="font-bold">{fee.description}</div>
              <div className="text-green-600 font-semibold">
                Rs {fee.amount}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(fee)}
                className="px-3 py-1 bg-yellow-400 rounded"
              >
                Edit
              </button>

              <button
                onClick={() => handleDelete(fee)}
                className="px-3 py-1 bg-red-500 text-white rounded"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
