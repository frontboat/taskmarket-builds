import type { DataSource } from "./api";

const API_BASE = "https://api-market.daydreams.systems/api";

export function createMockDataSource(): DataSource {
  return {
    async getDemandData(geoCode: string, category: string) {
      return { geoCode, category, exists: true };
    },
    async getGeoExists(_geoCode: string) {
      return true;
    },
  };
}

export function createLiveDataSource(): DataSource {
  return {
    async getDemandData(geoCode: string, category: string) {
      try {
        const res = await fetch(`${API_BASE}/demand/data?geoCode=${geoCode}&category=${category}`);
        if (!res.ok) return null;
        const data = (await res.json()) as any;
        return {
          geoCode: data.geoCode ?? geoCode,
          category: data.category ?? category,
          exists: true,
        };
      } catch {
        return null;
      }
    },
    async getGeoExists(geoCode: string) {
      try {
        const res = await fetch(`${API_BASE}/geo/exists?geoCode=${geoCode}`);
        if (!res.ok) return false;
        const data = (await res.json()) as any;
        return data.exists ?? false;
      } catch {
        return false;
      }
    },
  };
}
