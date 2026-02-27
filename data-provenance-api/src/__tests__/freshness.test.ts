import { describe, it, expect } from "bun:test";
import { createProvenanceAPI, type DataSource } from "../api";
import type { DatasetRecord } from "../verification";

// ============================================================
// Mock DataSource for performance tests
// ============================================================
function createPerfMockDataSource(): DataSource {
  const records: DatasetRecord[] = [];
  // Generate 50 datasets for load testing
  for (let i = 0; i < 50; i++) {
    records.push({
      datasetId: `ds-perf-${i}`,
      sources: [
        {
          sourceId: `src-perf-${i}-a`,
          type: "api",
          updatedAt: new Date(Date.now() - i * 60000).toISOString(),
          dataPoints: 1000 + i * 100,
          parentDatasetId: null,
          transformType: "ingest",
        },
        {
          sourceId: `src-perf-${i}-b`,
          type: "database",
          updatedAt: new Date(Date.now() - i * 30000).toISOString(),
          dataPoints: 500 + i * 50,
          parentDatasetId: null,
          transformType: "etl",
        },
      ],
      content: `performance test content for dataset ${i} with some payload data`,
      lastUpdated: new Date(Date.now() - i * 60000).toISOString(),
    });
  }

  return {
    async getDatasetRecord(datasetId: string): Promise<DatasetRecord | null> {
      return records.find((r) => r.datasetId === datasetId) ?? null;
    },
    async getAllRecords(): Promise<DatasetRecord[]> {
      return records;
    },
  };
}

// ============================================================
// Freshness Quality Tests
// ============================================================
describe("Freshness metadata quality", () => {
  const ds = createPerfMockDataSource();
  const app = createProvenanceAPI(ds);

  it("freshness timestamp is a valid ISO datetime", async () => {
    const res = await app.request("/v1/provenance/freshness?datasetId=ds-perf-0");
    const body = await res.json();
    expect(() => new Date(body.freshness.timestamp)).not.toThrow();
    expect(new Date(body.freshness.timestamp).toISOString()).toBe(body.freshness.timestamp);
  });

  it("freshness ageSeconds is non-negative", async () => {
    const res = await app.request("/v1/provenance/freshness?datasetId=ds-perf-0");
    const body = await res.json();
    expect(body.freshness.ageSeconds).toBeGreaterThanOrEqual(0);
  });

  it("lineage freshness is valid", async () => {
    const res = await app.request("/v1/provenance/lineage?datasetId=ds-perf-0");
    const body = await res.json();
    expect(body.freshness.timestamp).toBeDefined();
    expect(typeof body.freshness.stale).toBe("boolean");
  });

  it("verify-hash freshness is valid", async () => {
    const res = await app.request("/v1/provenance/verify-hash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datasetId: "ds-perf-0",
        expectedHash: "abc123",
      }),
    });
    const body = await res.json();
    expect(body.freshness).toBeDefined();
    expect(body.freshness.ageSeconds).toBeGreaterThanOrEqual(0);
  });

  it("staleness_ms matches lastUpdated delta", async () => {
    const res = await app.request("/v1/provenance/freshness?datasetId=ds-perf-0");
    const body = await res.json();
    const expectedStaleness = Date.now() - new Date(body.lastUpdated).getTime();
    // Allow 2 seconds of tolerance for test execution time
    expect(Math.abs(body.staleness_ms - expectedStaleness)).toBeLessThan(2000);
  });

  it("SLA correctly identifies fresh datasets", async () => {
    // ds-perf-0 is recent (less than 5 minutes)
    const res = await app.request("/v1/provenance/freshness?datasetId=ds-perf-0&maxStalenessMs=300000");
    const body = await res.json();
    expect(body.sla_status).toBe("fresh");
  });

  it("SLA correctly identifies stale datasets", async () => {
    // ds-perf-49 is ~49 minutes old, should be stale with 5-minute threshold
    const res = await app.request("/v1/provenance/freshness?datasetId=ds-perf-49&maxStalenessMs=300000");
    const body = await res.json();
    expect(body.sla_status).toBe("stale");
  });

  it("confidence reflects data richness", async () => {
    const res0 = await app.request("/v1/provenance/freshness?datasetId=ds-perf-0");
    const body0 = await res0.json();
    expect(body0.confidence).toBeGreaterThan(0);
    expect(body0.confidence).toBeLessThanOrEqual(1);
  });
});

// ============================================================
// P95 Response Time Tests (<500ms)
// ============================================================
describe("P95 response time < 500ms", () => {
  const ds = createPerfMockDataSource();
  const app = createProvenanceAPI(ds);

  it("lineage P95 < 500ms over 20 requests", async () => {
    const times: number[] = [];
    for (let i = 0; i < 20; i++) {
      const dsId = `ds-perf-${i % 50}`;
      const start = performance.now();
      await app.request(`/v1/provenance/lineage?datasetId=${dsId}`);
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)];
    expect(p95).toBeLessThan(500);
  });

  it("freshness P95 < 500ms over 20 requests", async () => {
    const times: number[] = [];
    for (let i = 0; i < 20; i++) {
      const dsId = `ds-perf-${i % 50}`;
      const start = performance.now();
      await app.request(`/v1/provenance/freshness?datasetId=${dsId}`);
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)];
    expect(p95).toBeLessThan(500);
  });

  it("verify-hash P95 < 500ms over 20 requests", async () => {
    const times: number[] = [];
    for (let i = 0; i < 20; i++) {
      const dsId = `ds-perf-${i % 50}`;
      const start = performance.now();
      await app.request("/v1/provenance/verify-hash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId: dsId,
          expectedHash: "abc123",
          algorithm: "sha256",
        }),
      });
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)];
    expect(p95).toBeLessThan(500);
  });
});

// ============================================================
// Edge cases and data quality
// ============================================================
describe("Edge cases", () => {
  const ds = createPerfMockDataSource();
  const app = createProvenanceAPI(ds);

  it("handles very large maxStalenessMs", async () => {
    const res = await app.request("/v1/provenance/freshness?datasetId=ds-perf-0&maxStalenessMs=999999999");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sla_status).toBe("fresh");
  });

  it("handles minimal maxStalenessMs (0)", async () => {
    const res = await app.request("/v1/provenance/freshness?datasetId=ds-perf-0&maxStalenessMs=0");
    expect(res.status).toBe(200);
    const body = await res.json();
    // Any data will be stale with 0ms threshold
    expect(body.sla_status).toBe("stale");
  });

  it("lineage maxDepth=10 works", async () => {
    const res = await app.request("/v1/provenance/lineage?datasetId=ds-perf-0&maxDepth=10");
    expect(res.status).toBe(200);
  });

  it("lineage maxDepth=1 works", async () => {
    const res = await app.request("/v1/provenance/lineage?datasetId=ds-perf-0&maxDepth=1");
    expect(res.status).toBe(200);
  });

  it("verify-hash with uppercase hex is accepted", async () => {
    const res = await app.request("/v1/provenance/verify-hash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datasetId: "ds-perf-0",
        expectedHash: "ABCDEF0123456789",
        algorithm: "sha256",
      }),
    });
    expect(res.status).toBe(200);
  });

  it("multiple sequential requests return consistent data", async () => {
    const res1 = await app.request("/v1/provenance/freshness?datasetId=ds-perf-0");
    const res2 = await app.request("/v1/provenance/freshness?datasetId=ds-perf-0");
    const body1 = await res1.json();
    const body2 = await res2.json();
    expect(body1.datasetId).toBe(body2.datasetId);
    expect(body1.lastUpdated).toBe(body2.lastUpdated);
  });
});
