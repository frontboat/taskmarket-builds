import type { DataSource } from "./api";

const API_BASE = "https://api-market.daydreams.systems/api";

export function createComplianceDataSource(): DataSource {
  return {
    async checkEntity(entityName: string, entityType: string): Promise<{ found: boolean }> {
      try {
        const res = await fetch(`${API_BASE}/compliance/check?name=${encodeURIComponent(entityName)}&type=${entityType}`);
        if (!res.ok) return { found: false };
        const data = (await res.json()) as any;
        return { found: data.found ?? false };
      } catch {
        return { found: false };
      }
    },

    async getAddressInfo(address: string): Promise<{ exists: boolean } | null> {
      try {
        const res = await fetch(`${API_BASE}/compliance/address?address=${address}`);
        if (!res.ok) return null;
        const data = (await res.json()) as any;
        return { exists: data.exists ?? false };
      } catch {
        return { exists: true }; // Default to allowing lookup
      }
    },

    async getJurisdictionData(jurisdiction: string): Promise<{ supported: boolean } | null> {
      try {
        const res = await fetch(`${API_BASE}/compliance/jurisdiction?code=${jurisdiction}`);
        if (!res.ok) return null;
        const data = (await res.json()) as any;
        return { supported: data.supported ?? false };
      } catch {
        return { supported: true }; // Default to allowing lookup
      }
    },
  };
}

// Mock data source for testing
export function createMockDataSource(): DataSource {
  return {
    async checkEntity(_entityName: string, _entityType: string): Promise<{ found: boolean }> {
      return { found: true };
    },

    async getAddressInfo(_address: string): Promise<{ exists: boolean } | null> {
      return { exists: true };
    },

    async getJurisdictionData(_jurisdiction: string): Promise<{ supported: boolean } | null> {
      return { supported: true };
    },
  };
}
