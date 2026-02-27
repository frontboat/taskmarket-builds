import { describe, test, expect } from "bun:test";
import { createIdentityAPI, type DataSource } from "../api";

const mockStats = {
  registered: true,
  completedTasks: 10,
  ratedTasks: 8,
  totalStars: 680,
  averageRating: 85,
  totalEarnings: "10000000",
  skills: ["api", "typescript"],
  recentRatings: [
    { taskId: "0xabc1", rating: 90, createdAt: "2026-02-20T00:00:00.000Z" },
    { taskId: "0xabc2", rating: 80, createdAt: "2026-02-21T00:00:00.000Z" },
    { taskId: "0xabc3", rating: 85, createdAt: "2026-02-22T00:00:00.000Z" },
  ],
};

const VALID_ADDR = "0x92de3C10764a03B2455d5f4A4b7FCBd0e281Aa92";
const UNKNOWN_ADDR = "0x0000000000000000000000000000000000000001";

const mockDataSource: DataSource = {
  async getAgentStats(address: string) {
    if (address === VALID_ADDR) return mockStats;
    return null;
  },
  async getIdentityStatus(address: string) {
    if (address === VALID_ADDR) return { registered: true, agentId: "20864" };
    return { registered: false, agentId: null };
  },
};

const app = createIdentityAPI(mockDataSource);

async function get(path: string) {
  const req = new Request(`http://localhost${path}`);
  return app.fetch(req);
}

describe("Integration Tests: API Endpoints", () => {
  // --- Reputation ---

  describe("GET /v1/identity/reputation", () => {
    test("returns 200 with valid agent", async () => {
      const res = await get(`/v1/identity/reputation?agentAddress=${VALID_ADDR}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.agentAddress).toBe(VALID_ADDR);
      expect(body.trustScore).toBeGreaterThan(0);
      expect(body.confidence).toBeGreaterThan(0);
      expect(body.freshness).toBeDefined();
      expect(body.freshness.stale).toBe(false);
      expect(body.onchainIdentityState).toBe("registered");
    });

    test("returns 404 for unknown agent", async () => {
      const res = await get(`/v1/identity/reputation?agentAddress=${UNKNOWN_ADDR}`);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe("AGENT_NOT_FOUND");
    });

    test("returns 400 for invalid address", async () => {
      const res = await get("/v1/identity/reputation?agentAddress=invalid");
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    test("returns 400 for missing address", async () => {
      const res = await get("/v1/identity/reputation");
      expect(res.status).toBe(400);
    });

    test("accepts optional timeframe parameter", async () => {
      const res = await get(`/v1/identity/reputation?agentAddress=${VALID_ADDR}&timeframe=30d`);
      expect(res.status).toBe(200);
    });

    test("output includes all required fields", async () => {
      const res = await get(`/v1/identity/reputation?agentAddress=${VALID_ADDR}`);
      const body = await res.json();
      expect(body).toHaveProperty("trustScore");
      expect(body).toHaveProperty("completionRate");
      expect(body).toHaveProperty("disputeRate");
      expect(body).toHaveProperty("totalTasks");
      expect(body).toHaveProperty("onchainIdentityState");
      expect(body).toHaveProperty("confidence");
      expect(body).toHaveProperty("freshness");
    });
  });

  // --- History ---

  describe("GET /v1/identity/history", () => {
    test("returns 200 with entries", async () => {
      const res = await get(`/v1/identity/history?agentAddress=${VALID_ADDR}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.agentAddress).toBe(VALID_ADDR);
      expect(body.entries).toBeInstanceOf(Array);
      expect(body.entries.length).toBeGreaterThan(0);
      expect(body.total).toBe(3);
      expect(body.freshness).toBeDefined();
    });

    test("respects limit parameter", async () => {
      const res = await get(`/v1/identity/history?agentAddress=${VALID_ADDR}&limit=1`);
      const body = await res.json();
      expect(body.entries).toHaveLength(1);
      expect(body.total).toBe(3); // total count unchanged
    });

    test("respects offset parameter", async () => {
      const res = await get(`/v1/identity/history?agentAddress=${VALID_ADDR}&offset=2`);
      const body = await res.json();
      expect(body.entries).toHaveLength(1); // only 1 left after offset 2
    });

    test("returns 404 for unknown agent", async () => {
      const res = await get(`/v1/identity/history?agentAddress=${UNKNOWN_ADDR}`);
      expect(res.status).toBe(404);
    });

    test("returns 400 for invalid address", async () => {
      const res = await get("/v1/identity/history?agentAddress=bad");
      expect(res.status).toBe(400);
    });

    test("entries have required fields", async () => {
      const res = await get(`/v1/identity/history?agentAddress=${VALID_ADDR}`);
      const body = await res.json();
      const entry = body.entries[0];
      expect(entry).toHaveProperty("taskId");
      expect(entry).toHaveProperty("role");
      expect(entry).toHaveProperty("status");
      expect(entry).toHaveProperty("rating");
      expect(entry).toHaveProperty("completedAt");
    });
  });

  // --- Trust Breakdown ---

  describe("GET /v1/identity/trust-breakdown", () => {
    test("returns 200 with components", async () => {
      const res = await get(`/v1/identity/trust-breakdown?agentAddress=${VALID_ADDR}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.agentAddress).toBe(VALID_ADDR);
      expect(body.overallTrustScore).toBeGreaterThan(0);
      expect(body.components).toBeInstanceOf(Array);
      expect(body.components.length).toBe(4);
      expect(body.confidence).toBeGreaterThan(0);
      expect(body.freshness).toBeDefined();
    });

    test("returns 404 for unknown agent", async () => {
      const res = await get(`/v1/identity/trust-breakdown?agentAddress=${UNKNOWN_ADDR}`);
      expect(res.status).toBe(404);
    });

    test("returns 400 for invalid address", async () => {
      const res = await get("/v1/identity/trust-breakdown?agentAddress=xyz");
      expect(res.status).toBe(400);
    });

    test("components include expected trust dimensions", async () => {
      const res = await get(`/v1/identity/trust-breakdown?agentAddress=${VALID_ADDR}`);
      const body = await res.json();
      const names = body.components.map((c: any) => c.component);
      expect(names).toContain("completion_rate");
      expect(names).toContain("rating_average");
      expect(names).toContain("onchain_identity");
      expect(names).toContain("dispute_history");
    });

    test("component weights sum to ~1.0", async () => {
      const res = await get(`/v1/identity/trust-breakdown?agentAddress=${VALID_ADDR}`);
      const body = await res.json();
      const totalWeight = body.components.reduce((sum: number, c: any) => sum + c.weight, 0);
      expect(totalWeight).toBeCloseTo(1.0, 5);
    });

    test("overall score matches weighted component sum", async () => {
      const res = await get(`/v1/identity/trust-breakdown?agentAddress=${VALID_ADDR}`);
      const body = await res.json();
      const computed = body.components.reduce(
        (sum: number, c: any) => sum + c.score * c.weight,
        0
      );
      expect(body.overallTrustScore).toBeCloseTo(computed, 1);
    });
  });
});
