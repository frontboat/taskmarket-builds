import { describe, test, expect } from "bun:test";
import { createDemandAPI, type DataSource } from "../api";
import { freshnessSchema } from "../schemas";

const mockDataSource: DataSource = {
  async getDemandData(geoCode: string, category: string) {
    return { geoCode, category, exists: true };
  },
  async getGeoExists(geoCode: string) {
    return true;
  },
};

const app = createDemandAPI(mockDataSource);

async function get(path: string) {
  return app.fetch(new Request(`http://localhost${path}`));
}

describe("Freshness & Quality Tests", () => {
  describe("All endpoints include freshness metadata", () => {
    const endpoints = [
      "/v1/demand/index?geoType=zip&geoCode=90210&category=plumbing",
      "/v1/demand/trend?geoType=zip&geoCode=90210&category=plumbing",
      "/v1/demand/anomalies?geoType=zip&geoCode=90210",
    ];

    for (const path of endpoints) {
      test(`${path.split("?")[0]} includes valid freshness`, async () => {
        const res = await get(path);
        const body = await res.json();
        const result = freshnessSchema.safeParse(body.freshness);
        expect(result.success).toBe(true);
      });

      test(`${path.split("?")[0]} freshness has recent timestamp`, async () => {
        const before = Date.now();
        const res = await get(path);
        const after = Date.now();
        const body = await res.json();
        const ts = new Date(body.freshness.timestamp).getTime();
        expect(ts).toBeGreaterThanOrEqual(before - 1000);
        expect(ts).toBeLessThanOrEqual(after + 1000);
      });

      test(`${path.split("?")[0]} freshness is not stale on fresh fetch`, async () => {
        const res = await get(path);
        const body = await res.json();
        expect(body.freshness.stale).toBe(false);
        expect(body.freshness.ageSeconds).toBeLessThanOrEqual(1);
      });
    }
  });

  describe("Confidence propagation", () => {
    test("demand index endpoint includes confidence", async () => {
      const res = await get("/v1/demand/index?geoType=zip&geoCode=90210&category=plumbing");
      const body = await res.json();
      expect(body.confidence).toBeGreaterThan(0);
      expect(body.confidence).toBeLessThanOrEqual(1);
    });

    test("confidence is consistent across calls", async () => {
      const res1 = await get("/v1/demand/index?geoType=zip&geoCode=90210&category=plumbing");
      const res2 = await get("/v1/demand/index?geoType=zip&geoCode=90210&category=plumbing");
      const body1 = await res1.json();
      const body2 = await res2.json();
      expect(body1.confidence).toBe(body2.confidence);
    });
  });

  describe("Response time (P95 < 500ms)", () => {
    test("demand index endpoint responds under 500ms", async () => {
      const start = performance.now();
      await get("/v1/demand/index?geoType=zip&geoCode=90210&category=plumbing");
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500);
    });

    test("trend endpoint responds under 500ms", async () => {
      const start = performance.now();
      await get("/v1/demand/trend?geoType=zip&geoCode=90210&category=plumbing");
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500);
    });

    test("anomalies endpoint responds under 500ms", async () => {
      const start = performance.now();
      await get("/v1/demand/anomalies?geoType=zip&geoCode=90210");
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500);
    });

    test("P95 across 20 requests stays under 500ms", async () => {
      const times: number[] = [];
      for (let i = 0; i < 20; i++) {
        const start = performance.now();
        await get("/v1/demand/index?geoType=zip&geoCode=90210&category=plumbing");
        times.push(performance.now() - start);
      }
      times.sort((a, b) => a - b);
      const p95 = times[Math.floor(times.length * 0.95)];
      expect(p95).toBeLessThan(500);
    });
  });
});
