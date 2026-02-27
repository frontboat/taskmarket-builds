import { describe, it, expect, beforeAll } from "bun:test";
import { createRiskAPI } from "../api";
import { createMockDataSource } from "../datasource";
import { computeFreshness } from "../risk-scoring";
import { freshnessSchema } from "../schemas";

let app: ReturnType<typeof createRiskAPI>;

beforeAll(() => {
  app = createRiskAPI(createMockDataSource());
});

const VALID_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";

// --- Freshness Metadata ---

describe("freshness metadata", () => {
  it("computeFreshness output validates against freshnessSchema", () => {
    const freshness = computeFreshness(new Date());
    expect(freshnessSchema.safeParse(freshness).success).toBe(true);
  });

  it("ageSeconds is 0 when fetched now", () => {
    const now = new Date();
    const freshness = computeFreshness(now, now);
    expect(freshness.ageSeconds).toBe(0);
  });

  it("stale is false when ageSeconds < threshold", () => {
    const fetchedAt = new Date();
    const now = new Date(fetchedAt.getTime() + 60_000); // 60s later
    const freshness = computeFreshness(fetchedAt, now);
    expect(freshness.stale).toBe(false);
  });

  it("stale is true when ageSeconds > threshold (default 300s)", () => {
    const fetchedAt = new Date();
    const now = new Date(fetchedAt.getTime() + 600_000); // 10 min later
    const freshness = computeFreshness(fetchedAt, now);
    expect(freshness.stale).toBe(true);
  });

  it("custom staleness threshold is respected", () => {
    const fetchedAt = new Date();
    const now = new Date(fetchedAt.getTime() + 10_000); // 10s later
    const freshness = computeFreshness(fetchedAt, now, 5);
    expect(freshness.stale).toBe(true);
  });

  it("ageSeconds is never negative", () => {
    const fetchedAt = new Date();
    const now = new Date(fetchedAt.getTime() - 1000); // in the past
    const freshness = computeFreshness(fetchedAt, now);
    expect(freshness.ageSeconds).toBeGreaterThanOrEqual(0);
  });

  it("timestamp matches the fetchedAt date", () => {
    const fetchedAt = new Date("2024-06-15T12:00:00.000Z");
    const freshness = computeFreshness(fetchedAt);
    expect(freshness.timestamp).toBe("2024-06-15T12:00:00.000Z");
  });
});

// --- Freshness in API Responses ---

describe("freshness in API responses", () => {
  it("/v1/risk/score includes freshness with stale=false", async () => {
    const res = await app.request("/v1/risk/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: VALID_ADDRESS }),
    });
    const data = await res.json();
    expect(data.freshness.stale).toBe(false);
    expect(data.freshness.ageSeconds).toBeLessThanOrEqual(2);
  });

  it("/v1/risk/exposure-paths includes freshness", async () => {
    const res = await app.request(`/v1/risk/exposure-paths?address=${VALID_ADDRESS}`);
    const data = await res.json();
    expect(freshnessSchema.safeParse(data.freshness).success).toBe(true);
    expect(data.freshness.stale).toBe(false);
  });

  it("/v1/risk/entity-profile includes freshness", async () => {
    const res = await app.request(`/v1/risk/entity-profile?address=${VALID_ADDRESS}`);
    const data = await res.json();
    expect(freshnessSchema.safeParse(data.freshness).success).toBe(true);
    expect(data.freshness.stale).toBe(false);
  });
});

// --- P95 Response Time < 500ms ---

describe("P95 response time", () => {
  const ITERATIONS = 50;

  it("POST /v1/risk/score P95 < 500ms", async () => {
    const times: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      await app.request("/v1/risk/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: VALID_ADDRESS }),
      });
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(ITERATIONS * 0.95)];
    expect(p95).toBeLessThan(500);
  });

  it("GET /v1/risk/exposure-paths P95 < 500ms", async () => {
    const times: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      await app.request(`/v1/risk/exposure-paths?address=${VALID_ADDRESS}`);
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(ITERATIONS * 0.95)];
    expect(p95).toBeLessThan(500);
  });

  it("GET /v1/risk/entity-profile P95 < 500ms", async () => {
    const times: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      await app.request(`/v1/risk/entity-profile?address=${VALID_ADDRESS}`);
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(ITERATIONS * 0.95)];
    expect(p95).toBeLessThan(500);
  });
});
