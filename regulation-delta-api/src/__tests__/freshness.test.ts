import { describe, test, expect } from "bun:test";
import { createRegulationAPI, type DataSource } from "../api";
import { computeFreshness } from "../regulation";

function createMockDataSource(): DataSource {
  return {
    async getRegulationData(jurisdiction: string) {
      if (jurisdiction === "XX") return null;
      return { jurisdiction, available: true };
    },
  };
}

function createApp() {
  return createRegulationAPI(createMockDataSource());
}

// --- Freshness Quality Tests ---

describe("freshness metadata", () => {
  test("delta endpoint freshness timestamp is recent (within 5 seconds)", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/delta?jurisdiction=US&since=2025-01-01");
    const body = await res.json();
    const ts = new Date(body.freshness.timestamp);
    const now = new Date();
    const diffMs = Math.abs(now.getTime() - ts.getTime());
    expect(diffMs).toBeLessThan(5000);
  });

  test("impact endpoint freshness timestamp is recent", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/impact?jurisdiction=US");
    const body = await res.json();
    const ts = new Date(body.freshness.timestamp);
    const now = new Date();
    const diffMs = Math.abs(now.getTime() - ts.getTime());
    expect(diffMs).toBeLessThan(5000);
  });

  test("map-controls endpoint freshness timestamp is recent", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/map-controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruleId: "US-REG-001", control_framework: "soc2", jurisdiction: "US" }),
    });
    const body = await res.json();
    const ts = new Date(body.freshness.timestamp);
    const now = new Date();
    expect(Math.abs(now.getTime() - ts.getTime())).toBeLessThan(5000);
  });

  test("freshness ageSeconds is zero or very small for fresh response", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/delta?jurisdiction=US&since=2025-01-01");
    const body = await res.json();
    expect(body.freshness.ageSeconds).toBeLessThanOrEqual(2);
  });

  test("freshness stale is false for fresh response", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/delta?jurisdiction=US&since=2025-01-01");
    const body = await res.json();
    expect(body.freshness.stale).toBe(false);
  });

  test("computeFreshness marks stale correctly at boundary", () => {
    const threshold = 300;
    const fetchedAt = new Date("2025-01-15T10:00:00.000Z");
    // Exactly at threshold
    const nowAtThreshold = new Date("2025-01-15T10:05:00.000Z");
    const atBoundary = computeFreshness(fetchedAt, nowAtThreshold, threshold);
    expect(atBoundary.stale).toBe(false); // not stale at exactly threshold

    // One second past threshold
    const nowPastThreshold = new Date("2025-01-15T10:05:01.000Z");
    const pastBoundary = computeFreshness(fetchedAt, nowPastThreshold, threshold);
    expect(pastBoundary.stale).toBe(true);
  });
});

// --- P95 Response Time Tests ---

describe("P95 response time < 500ms", () => {
  test("delta endpoint P95 < 500ms over 50 requests", async () => {
    const app = createApp();
    const times: number[] = [];

    for (let i = 0; i < 50; i++) {
      const start = performance.now();
      await app.request("/v1/regulations/delta?jurisdiction=US&since=2025-01-01");
      times.push(performance.now() - start);
    }

    times.sort((a, b) => a - b);
    const p95Index = Math.ceil(times.length * 0.95) - 1;
    const p95 = times[p95Index];
    expect(p95).toBeLessThan(500);
  });

  test("impact endpoint P95 < 500ms over 50 requests", async () => {
    const app = createApp();
    const times: number[] = [];

    for (let i = 0; i < 50; i++) {
      const start = performance.now();
      await app.request("/v1/regulations/impact?jurisdiction=US");
      times.push(performance.now() - start);
    }

    times.sort((a, b) => a - b);
    const p95Index = Math.ceil(times.length * 0.95) - 1;
    const p95 = times[p95Index];
    expect(p95).toBeLessThan(500);
  });

  test("map-controls endpoint P95 < 500ms over 50 requests", async () => {
    const app = createApp();
    const times: number[] = [];

    for (let i = 0; i < 50; i++) {
      const start = performance.now();
      await app.request("/v1/regulations/map-controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleId: "US-REG-001", control_framework: "soc2", jurisdiction: "US" }),
      });
      times.push(performance.now() - start);
    }

    times.sort((a, b) => a - b);
    const p95Index = Math.ceil(times.length * 0.95) - 1;
    const p95 = times[p95Index];
    expect(p95).toBeLessThan(500);
  });

  test("delta with industry filter P95 < 500ms", async () => {
    const app = createApp();
    const times: number[] = [];

    for (let i = 0; i < 30; i++) {
      const start = performance.now();
      await app.request("/v1/regulations/delta?jurisdiction=US&since=2025-01-01&industry=finance");
      times.push(performance.now() - start);
    }

    times.sort((a, b) => a - b);
    const p95Index = Math.ceil(times.length * 0.95) - 1;
    const p95 = times[p95Index];
    expect(p95).toBeLessThan(500);
  });
});

// --- Data Quality ---

describe("data quality checks", () => {
  test("delta response has non-empty deltas for valid jurisdiction", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/delta?jurisdiction=US&since=2025-01-01");
    const body = await res.json();
    expect(body.deltas.length).toBeGreaterThan(0);
  });

  test("impact response has non-empty impacts for valid jurisdiction", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/impact?jurisdiction=US");
    const body = await res.json();
    expect(body.impacts.length).toBeGreaterThan(0);
  });

  test("map-controls response has non-empty mapped_controls", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/map-controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruleId: "US-REG-001", control_framework: "soc2", jurisdiction: "US" }),
    });
    const body = await res.json();
    expect(body.mapped_controls.length).toBeGreaterThan(0);
  });

  test("all urgency_scores in delta are within 0-100", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/delta?jurisdiction=US&since=2025-01-01");
    const body = await res.json();
    for (const delta of body.deltas) {
      expect(delta.urgency_score).toBeGreaterThanOrEqual(0);
      expect(delta.urgency_score).toBeLessThanOrEqual(100);
    }
  });

  test("all mapping_confidence values are within 0-1", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/map-controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruleId: "US-REG-001", control_framework: "iso27001", jurisdiction: "US" }),
    });
    const body = await res.json();
    for (const mc of body.mapped_controls) {
      expect(mc.mapping_confidence).toBeGreaterThanOrEqual(0);
      expect(mc.mapping_confidence).toBeLessThanOrEqual(1);
    }
  });
});
