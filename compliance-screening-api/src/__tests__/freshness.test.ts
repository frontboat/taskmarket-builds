import { describe, test, expect } from "bun:test";
import { createScreeningAPI, type DataSource } from "../api";
import { computeFreshness } from "../screening";

function createMockDataSource(): DataSource {
  return {
    checkEntity: async () => ({ found: true }),
    getAddressInfo: async () => ({ exists: true }),
    getJurisdictionData: async () => ({ supported: true }),
  };
}

function createApp() {
  return createScreeningAPI(createMockDataSource());
}

// --- Freshness metadata tests ---

describe("freshness metadata", () => {
  test("screening check freshness is not stale on immediate response", async () => {
    const app = createApp();
    const res = await app.request("/v1/screening/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityName: "Test" }),
    });
    const body = await res.json();
    expect(body.freshness.stale).toBe(false);
    expect(body.freshness.ageSeconds).toBeLessThanOrEqual(2);
  });

  test("exposure chain freshness is not stale on immediate response", async () => {
    const app = createApp();
    const res = await app.request(
      "/v1/screening/exposure-chain?address=0x1234567890abcdef1234567890abcdef12345678"
    );
    const body = await res.json();
    expect(body.freshness.stale).toBe(false);
    expect(body.freshness.ageSeconds).toBeLessThanOrEqual(2);
  });

  test("jurisdiction risk freshness is not stale on immediate response", async () => {
    const app = createApp();
    const res = await app.request("/v1/screening/jurisdiction-risk?jurisdiction=US");
    const body = await res.json();
    expect(body.freshness.stale).toBe(false);
    expect(body.freshness.ageSeconds).toBeLessThanOrEqual(2);
  });

  test("freshness timestamp is valid ISO datetime", async () => {
    const app = createApp();
    const res = await app.request("/v1/screening/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityName: "Test" }),
    });
    const body = await res.json();
    const ts = new Date(body.freshness.timestamp);
    expect(ts.getTime()).not.toBeNaN();
  });

  test("computeFreshness marks old data as stale", () => {
    const old = new Date("2020-01-01T00:00:00Z");
    const now = new Date("2025-01-01T00:00:00Z");
    const f = computeFreshness(old, now);
    expect(f.stale).toBe(true);
    expect(f.ageSeconds).toBeGreaterThan(300);
  });

  test("computeFreshness fresh data within threshold", () => {
    const fetchedAt = new Date();
    const f = computeFreshness(fetchedAt);
    expect(f.stale).toBe(false);
    expect(f.ageSeconds).toBeLessThanOrEqual(1);
  });
});

// --- P95 response time tests ---

describe("P95 response time < 500ms", () => {
  test("screening check P95 < 500ms", async () => {
    const app = createApp();
    const times: number[] = [];

    for (let i = 0; i < 20; i++) {
      const start = performance.now();
      await app.request("/v1/screening/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityName: `Entity${i}` }),
      });
      times.push(performance.now() - start);
    }

    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)];
    expect(p95).toBeLessThan(500);
  });

  test("exposure chain P95 < 500ms", async () => {
    const app = createApp();
    const times: number[] = [];

    for (let i = 0; i < 20; i++) {
      const addr = `0x${i.toString(16).padStart(40, "0")}`;
      const start = performance.now();
      await app.request(`/v1/screening/exposure-chain?address=${addr}`);
      times.push(performance.now() - start);
    }

    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)];
    expect(p95).toBeLessThan(500);
  });

  test("jurisdiction risk P95 < 500ms", async () => {
    const app = createApp();
    const times: number[] = [];
    const jurisdictions = ["US", "GB", "IR", "KP", "CN", "JP", "DE", "FR", "BR", "RU",
      "IN", "AU", "CA", "MX", "ZA", "SY", "CU", "VE", "BY", "MM"];

    for (const j of jurisdictions) {
      const start = performance.now();
      await app.request(`/v1/screening/jurisdiction-risk?jurisdiction=${j}`);
      times.push(performance.now() - start);
    }

    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)];
    expect(p95).toBeLessThan(500);
  });

  test("screening check with full payload P95 < 500ms", async () => {
    const app = createApp();
    const times: number[] = [];

    for (let i = 0; i < 20; i++) {
      const start = performance.now();
      await app.request("/v1/screening/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityName: `Full Entity ${i}`,
          entityType: "organization",
          identifiers: [{ type: "tax_id", value: `TAX-${i}` }],
          addresses: [`0x${i.toString(16).padStart(40, "0")}`],
          jurisdictions: ["US", "GB"],
        }),
      });
      times.push(performance.now() - start);
    }

    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)];
    expect(p95).toBeLessThan(500);
  });

  test("exposure chain with max depth P95 < 500ms", async () => {
    const app = createApp();
    const times: number[] = [];

    for (let i = 0; i < 20; i++) {
      const addr = `0x${(i + 100).toString(16).padStart(40, "0")}`;
      const start = performance.now();
      await app.request(`/v1/screening/exposure-chain?address=${addr}&ownershipDepth=5`);
      times.push(performance.now() - start);
    }

    times.sort((a, b) => a - b);
    const p95 = times[Math.floor(times.length * 0.95)];
    expect(p95).toBeLessThan(500);
  });
});

// --- Quality tests ---

describe("data quality", () => {
  test("screening check always has evidence bundle", async () => {
    const app = createApp();
    for (const name of ["Alice", "Bob", "Charlie", "TestCorp"]) {
      const res = await app.request("/v1/screening/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityName: name }),
      });
      const body = await res.json();
      expect(body.evidence_bundle.length).toBeGreaterThanOrEqual(1);
    }
  });

  test("exposure chain entities have valid depth range", async () => {
    const app = createApp();
    const res = await app.request(
      "/v1/screening/exposure-chain?address=0xabcdef1234567890abcdef1234567890abcdef12&ownershipDepth=3"
    );
    const body = await res.json();
    for (const entity of body.chain) {
      expect(entity.depth).toBeGreaterThanOrEqual(1);
      expect(entity.depth).toBeLessThanOrEqual(3);
    }
  });

  test("jurisdiction risk factors always have descriptions", async () => {
    const app = createApp();
    const res = await app.request("/v1/screening/jurisdiction-risk?jurisdiction=GB");
    const body = await res.json();
    for (const factor of body.risk_factors) {
      expect(factor.description.length).toBeGreaterThan(0);
    }
  });

  test("jurisdiction risk level matches score", async () => {
    const app = createApp();
    for (const j of ["US", "KP", "CN"]) {
      const res = await app.request(`/v1/screening/jurisdiction-risk?jurisdiction=${j}`);
      const body = await res.json();
      if (body.risk_score >= 80) expect(body.risk_level).toBe("critical");
      else if (body.risk_score >= 55) expect(body.risk_level).toBe("high");
      else if (body.risk_score >= 25) expect(body.risk_level).toBe("medium");
      else expect(body.risk_level).toBe("low");
    }
  });
});
