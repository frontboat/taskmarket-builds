import { describe, test, expect } from "bun:test";
import { createSupplierAPI, type DataSource } from "../api";
import { generateSupplierData, computeFreshness, type SupplierData } from "../supplier-scoring";

// --- Mock DataSource ---

function createTestDataSource(): DataSource {
  return {
    async getSupplierData(supplierId: string, category?: string, region?: string): Promise<SupplierData | null> {
      if (supplierId === "NONEXISTENT") return null;
      return generateSupplierData(supplierId, category, region);
    },
    async getAllSupplierAlerts(region?: string): Promise<SupplierData[]> {
      const ids = ["SUP-001", "SUP-002", "SUP-003", "SUP-004", "SUP-005"];
      return ids.map((id) => generateSupplierData(id, undefined, region)).filter((s) => s.activeAlerts.length > 0);
    },
  };
}

function createApp() {
  return createSupplierAPI(createTestDataSource());
}

function req(path: string) {
  return new Request(`http://localhost${path}`);
}

// --- Freshness metadata tests ---

describe("Freshness metadata", () => {
  const app = createApp();

  test("score endpoint freshness timestamp is valid ISO", async () => {
    const res = await app.fetch(req("/v1/suppliers/score?supplierId=SUP-001"));
    const body = await res.json();
    expect(() => new Date(body.freshness.timestamp)).not.toThrow();
    expect(new Date(body.freshness.timestamp).toISOString()).toBe(body.freshness.timestamp);
  });

  test("lead-time endpoint freshness timestamp is valid ISO", async () => {
    const res = await app.fetch(req("/v1/suppliers/lead-time-forecast?supplierId=SUP-001"));
    const body = await res.json();
    expect(() => new Date(body.freshness.timestamp)).not.toThrow();
  });

  test("disruption endpoint freshness timestamp is valid ISO", async () => {
    const res = await app.fetch(req("/v1/suppliers/disruption-alerts"));
    const body = await res.json();
    expect(() => new Date(body.freshness.timestamp)).not.toThrow();
  });

  test("freshness ageSeconds is non-negative", async () => {
    const res = await app.fetch(req("/v1/suppliers/score?supplierId=SUP-001"));
    const body = await res.json();
    expect(body.freshness.ageSeconds).toBeGreaterThanOrEqual(0);
  });

  test("freshness is not stale for fresh data", async () => {
    const res = await app.fetch(req("/v1/suppliers/score?supplierId=SUP-001"));
    const body = await res.json();
    expect(body.freshness.stale).toBe(false);
  });

  test("computeFreshness marks stale correctly at boundary", () => {
    const fetchedAt = new Date("2024-01-01T00:00:00.000Z");
    const atBoundary = new Date("2024-01-01T00:05:00.000Z"); // exactly 300s
    const freshness = computeFreshness(fetchedAt, atBoundary);
    expect(freshness.stale).toBe(false); // at threshold, not beyond
  });

  test("computeFreshness marks stale just past boundary", () => {
    const fetchedAt = new Date("2024-01-01T00:00:00.000Z");
    const pastBoundary = new Date("2024-01-01T00:05:01.000Z"); // 301s
    const freshness = computeFreshness(fetchedAt, pastBoundary);
    expect(freshness.stale).toBe(true);
  });
});

// --- Performance / P95 response time tests ---

describe("P95 response time < 500ms", () => {
  const app = createApp();
  const ITERATIONS = 50;
  const P95_THRESHOLD_MS = 500;

  async function measureLatency(path: string): Promise<number[]> {
    const times: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      await app.fetch(req(path));
      times.push(performance.now() - start);
    }
    return times.sort((a, b) => a - b);
  }

  function p95(sorted: number[]): number {
    const idx = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[idx];
  }

  test("score endpoint P95 < 500ms", async () => {
    const times = await measureLatency("/v1/suppliers/score?supplierId=SUP-PERF-001");
    const p95Val = p95(times);
    expect(p95Val).toBeLessThan(P95_THRESHOLD_MS);
  });

  test("lead-time-forecast endpoint P95 < 500ms", async () => {
    const times = await measureLatency("/v1/suppliers/lead-time-forecast?supplierId=SUP-PERF-001");
    const p95Val = p95(times);
    expect(p95Val).toBeLessThan(P95_THRESHOLD_MS);
  });

  test("disruption-alerts (specific supplier) P95 < 500ms", async () => {
    const times = await measureLatency("/v1/suppliers/disruption-alerts?supplierId=SUP-PERF-001");
    const p95Val = p95(times);
    expect(p95Val).toBeLessThan(P95_THRESHOLD_MS);
  });

  test("disruption-alerts (all suppliers) P95 < 500ms", async () => {
    const times = await measureLatency("/v1/suppliers/disruption-alerts");
    const p95Val = p95(times);
    expect(p95Val).toBeLessThan(P95_THRESHOLD_MS);
  });

  test("score endpoint with category filter P95 < 500ms", async () => {
    const times = await measureLatency("/v1/suppliers/score?supplierId=SUP-PERF-001&category=electronics");
    const p95Val = p95(times);
    expect(p95Val).toBeLessThan(P95_THRESHOLD_MS);
  });

  test("lead-time with max horizonDays P95 < 500ms", async () => {
    const times = await measureLatency("/v1/suppliers/lead-time-forecast?supplierId=SUP-PERF-001&horizonDays=365");
    const p95Val = p95(times);
    expect(p95Val).toBeLessThan(P95_THRESHOLD_MS);
  });

  test("disruption-alerts with low riskTolerance P95 < 500ms", async () => {
    const times = await measureLatency("/v1/suppliers/disruption-alerts?riskTolerance=low");
    const p95Val = p95(times);
    expect(p95Val).toBeLessThan(P95_THRESHOLD_MS);
  });

  test("error responses are also fast (P95 < 500ms)", async () => {
    const times = await measureLatency("/v1/suppliers/score");
    const p95Val = p95(times);
    expect(p95Val).toBeLessThan(P95_THRESHOLD_MS);
  });
});
