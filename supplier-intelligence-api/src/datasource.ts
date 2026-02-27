import type { DataSource } from "./api";
import { generateSupplierData, type SupplierData } from "./supplier-scoring";

export function createMockDataSource(): DataSource {
  return {
    async getSupplierData(
      supplierId: string,
      category?: string,
      region?: string
    ): Promise<SupplierData | null> {
      // Deterministic: same supplierId always returns same data
      return generateSupplierData(supplierId, category, region);
    },

    async getAllSupplierAlerts(
      region?: string
    ): Promise<SupplierData[]> {
      // Return a deterministic set of suppliers with alerts
      const supplierIds = [
        "SUP-001", "SUP-002", "SUP-003", "SUP-004", "SUP-005",
        "SUP-006", "SUP-007", "SUP-008", "SUP-009", "SUP-010",
      ];
      const suppliers = supplierIds.map((id) => generateSupplierData(id, undefined, region));
      return suppliers.filter((s) => s.activeAlerts.length > 0);
    },
  };
}
