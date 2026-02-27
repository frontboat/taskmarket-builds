import type { DataSource } from "./api";

const API_BASE = "https://api-market.daydreams.systems/api";

export function createRegulationDataSource(): DataSource {
  return {
    async getRegulationData(jurisdiction: string) {
      try {
        const res = await fetch(`${API_BASE}/regulations/jurisdictions?code=${jurisdiction}`);
        if (!res.ok) return null;

        const data = (await res.json()) as any;
        if (!data.jurisdiction) return null;

        return {
          jurisdiction: data.jurisdiction,
          available: data.available ?? true,
        };
      } catch {
        // Fallback: accept all known jurisdictions
        const known = ["US", "GB", "DE", "FR", "JP", "SG", "AU", "CA", "CH", "NL", "IE", "KR", "BR", "IN"];
        if (known.includes(jurisdiction)) {
          return { jurisdiction, available: true };
        }
        return null;
      }
    },
  };
}
