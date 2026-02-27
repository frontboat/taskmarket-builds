import { describe, test, expect } from "bun:test";
import { createIdentityAPI, type DataSource } from "../api";
import { freshnessSchema } from "../schemas";

const VALID_ADDR = "0x92de3C10764a03B2455d5f4A4b7FCBd0e281Aa92";

const mockDataSource: DataSource = {
  async getAgentStats() {
    return {
      registered: true,
      completedTasks: 5,
      ratedTasks: 3,
      totalStars: 240,
      averageRating: 80,
      totalEarnings: "5000000",
      skills: ["api"],
      recentRatings: [
        { taskId: "0x1", rating: 80, createdAt: "2026-02-20T00:00:00.000Z" },
      ],
    };
  },
  async getIdentityStatus() {
    return { registered: true, agentId: "100" };
  },
};

const app = createIdentityAPI(mockDataSource);

async function get(path: string) {
  return app.fetch(new Request(`http://localhost${path}`));
}

describe("Freshness & Quality Tests", () => {
  describe("All endpoints include freshness metadata", () => {
    const endpoints = [
      `/v1/identity/reputation?agentAddress=${VALID_ADDR}`,
      `/v1/identity/history?agentAddress=${VALID_ADDR}`,
      `/v1/identity/trust-breakdown?agentAddress=${VALID_ADDR}`,
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
    test("reputation endpoint includes confidence", async () => {
      const res = await get(`/v1/identity/reputation?agentAddress=${VALID_ADDR}`);
      const body = await res.json();
      expect(body.confidence).toBeGreaterThan(0);
      expect(body.confidence).toBeLessThanOrEqual(1);
    });

    test("trust-breakdown endpoint includes confidence", async () => {
      const res = await get(`/v1/identity/trust-breakdown?agentAddress=${VALID_ADDR}`);
      const body = await res.json();
      expect(body.confidence).toBeGreaterThan(0);
      expect(body.confidence).toBeLessThanOrEqual(1);
    });

    test("confidence is consistent between reputation and trust-breakdown", async () => {
      const rep = await get(`/v1/identity/reputation?agentAddress=${VALID_ADDR}`);
      const tb = await get(`/v1/identity/trust-breakdown?agentAddress=${VALID_ADDR}`);
      const repBody = await rep.json();
      const tbBody = await tb.json();
      expect(repBody.confidence).toBe(tbBody.confidence);
    });
  });

  describe("Response time", () => {
    test("reputation endpoint responds under 500ms", async () => {
      const start = performance.now();
      await get(`/v1/identity/reputation?agentAddress=${VALID_ADDR}`);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500);
    });

    test("history endpoint responds under 500ms", async () => {
      const start = performance.now();
      await get(`/v1/identity/history?agentAddress=${VALID_ADDR}`);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500);
    });

    test("trust-breakdown endpoint responds under 500ms", async () => {
      const start = performance.now();
      await get(`/v1/identity/trust-breakdown?agentAddress=${VALID_ADDR}`);
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500);
    });
  });
});
