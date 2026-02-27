import type { DataSource } from "./api";
import type { AddressRiskData } from "./risk-scoring";

// Null address used as "unknown" sentinel
const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

// --- Mock Data Source ---

export function createMockDataSource(): DataSource {
  return {
    async getAddressData(address: string): Promise<AddressRiskData | null> {
      // The null address is treated as "not found" for testing
      if (address.toLowerCase() === NULL_ADDRESS.toLowerCase()) {
        return null;
      }

      // For any other valid address, return deterministic mock data
      // The actual risk computation is done in risk-scoring.ts using the address seed
      return {
        address,
        transactionCount: 42,
        uniqueCounterparties: 15,
        mixerInteractions: 0,
        bridgeUsage: 3,
        sanctionedProximityHops: 4,
        accountAgeDays: 365,
        volumeUsd: 150_000,
      };
    },
  };
}

// --- Live Data Source (production) ---

const API_BASE = "https://api-market.daydreams.systems/api";

export function createLiveDataSource(): DataSource {
  return {
    async getAddressData(address: string): Promise<AddressRiskData | null> {
      try {
        const res = await fetch(`${API_BASE}/risk/address?address=${address}`);
        if (!res.ok) return null;

        const data = (await res.json()) as any;
        if (!data.address) return null;

        return {
          address: data.address,
          transactionCount: data.transactionCount ?? 0,
          uniqueCounterparties: data.uniqueCounterparties ?? 0,
          mixerInteractions: data.mixerInteractions ?? 0,
          bridgeUsage: data.bridgeUsage ?? 0,
          sanctionedProximityHops: data.sanctionedProximityHops ?? 0,
          accountAgeDays: data.accountAgeDays ?? 0,
          volumeUsd: data.volumeUsd ?? 0,
        };
      } catch {
        return null;
      }
    },
  };
}
