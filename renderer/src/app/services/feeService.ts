export const feeService = (db: any) => {
  return {
    // CREATE
    async createFee(fee: any) {
      return db.localDB.put({
        _id: `fee_${Date.now()}`,
        type: "fee-list",
        ...fee,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    },

    // READ ALL
    async getFees() {
      const res = await db.localDB.allDocs({ include_docs: true });

      return res.rows
        .map((r: any) => r.doc)
        .filter((d: any) => d?.type === "fee-list" && !d._deleted);
    },

    // UPDATE
    async updateFee(fee: any) {
      return db.localDB.put({
        ...fee,
        type: "fee-list",
        updatedAt: new Date().toISOString(),
      });
    },

    // DELETE
    async deleteFee(fee: any) {
      return db.localDB.remove(fee);
    },
  };
};