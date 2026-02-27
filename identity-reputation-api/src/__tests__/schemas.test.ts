import { describe, test, expect } from "bun:test";
import {
  reputationInputSchema,
  reputationOutputSchema,
  historyInputSchema,
  historyOutputSchema,
  trustBreakdownInputSchema,
  trustBreakdownOutputSchema,
  errorSchema,
} from "../schemas";

const NOW = new Date().toISOString();

describe("Contract Tests: Request/Response Schemas", () => {
  // --- Reputation endpoint ---

  describe("GET /v1/identity/reputation", () => {
    test("accepts valid input with all fields", () => {
      const result = reputationInputSchema.parse({
        agentAddress: "0x92de3C10764a03B2455d5f4A4b7FCBd0e281Aa92",
        chain: "base",
        timeframe: "30d",
      });
      expect(result.agentAddress).toBe("0x92de3C10764a03B2455d5f4A4b7FCBd0e281Aa92");
      expect(result.chain).toBe("base");
      expect(result.timeframe).toBe("30d");
    });

    test("applies defaults for optional fields", () => {
      const result = reputationInputSchema.parse({
        agentAddress: "0x92de3C10764a03B2455d5f4A4b7FCBd0e281Aa92",
      });
      expect(result.chain).toBe("base");
      expect(result.timeframe).toBe("all");
    });

    test("rejects invalid address", () => {
      expect(() =>
        reputationInputSchema.parse({ agentAddress: "not-an-address" })
      ).toThrow();
    });

    test("rejects invalid timeframe", () => {
      expect(() =>
        reputationInputSchema.parse({
          agentAddress: "0x92de3C10764a03B2455d5f4A4b7FCBd0e281Aa92",
          timeframe: "1y",
        })
      ).toThrow();
    });

    test("validates complete reputation output", () => {
      const output = reputationOutputSchema.parse({
        agentAddress: "0x92de3C10764a03B2455d5f4A4b7FCBd0e281Aa92",
        trustScore: 85.5,
        completionRate: 0.95,
        disputeRate: 0.02,
        totalTasks: 42,
        onchainIdentityState: "registered",
        confidence: 0.88,
        freshness: { timestamp: NOW, ageSeconds: 5, stale: false },
      });
      expect(output.trustScore).toBe(85.5);
      expect(output.confidence).toBe(0.88);
    });

    test("rejects trust score out of range", () => {
      expect(() =>
        reputationOutputSchema.parse({
          agentAddress: "0x92de3C10764a03B2455d5f4A4b7FCBd0e281Aa92",
          trustScore: 150,
          completionRate: 0.95,
          disputeRate: 0.02,
          totalTasks: 42,
          onchainIdentityState: "registered",
          confidence: 0.88,
          freshness: { timestamp: NOW, ageSeconds: 5, stale: false },
        })
      ).toThrow();
    });

    test("rejects confidence out of range", () => {
      expect(() =>
        reputationOutputSchema.parse({
          agentAddress: "0x92de3C10764a03B2455d5f4A4b7FCBd0e281Aa92",
          trustScore: 85,
          completionRate: 0.95,
          disputeRate: 0.02,
          totalTasks: 42,
          onchainIdentityState: "registered",
          confidence: 1.5,
          freshness: { timestamp: NOW, ageSeconds: 5, stale: false },
        })
      ).toThrow();
    });

    test("requires freshness in output", () => {
      expect(() =>
        reputationOutputSchema.parse({
          agentAddress: "0x92de3C10764a03B2455d5f4A4b7FCBd0e281Aa92",
          trustScore: 85,
          completionRate: 0.95,
          disputeRate: 0.02,
          totalTasks: 42,
          onchainIdentityState: "registered",
          confidence: 0.88,
        })
      ).toThrow();
    });
  });

  // --- History endpoint ---

  describe("GET /v1/identity/history", () => {
    test("accepts valid input with defaults", () => {
      const result = historyInputSchema.parse({
        agentAddress: "0x92de3C10764a03B2455d5f4A4b7FCBd0e281Aa92",
      });
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    });

    test("accepts custom limit and offset", () => {
      const result = historyInputSchema.parse({
        agentAddress: "0x92de3C10764a03B2455d5f4A4b7FCBd0e281Aa92",
        limit: 50,
        offset: 10,
      });
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(10);
    });

    test("rejects limit over 100", () => {
      expect(() =>
        historyInputSchema.parse({
          agentAddress: "0x92de3C10764a03B2455d5f4A4b7FCBd0e281Aa92",
          limit: 200,
        })
      ).toThrow();
    });

    test("validates complete history output", () => {
      const output = historyOutputSchema.parse({
        agentAddress: "0x92de3C10764a03B2455d5f4A4b7FCBd0e281Aa92",
        entries: [
          {
            taskId: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            role: "worker",
            status: "completed",
            reward: "3000000",
            rating: 85,
            counterparty: "0xD4e2DFF8BB35154d53B3381595240BE54A7A93ff",
            completedAt: NOW,
            evidenceUrls: ["https://github.com/example/pr/1"],
          },
        ],
        total: 1,
        freshness: { timestamp: NOW, ageSeconds: 2, stale: false },
      });
      expect(output.entries).toHaveLength(1);
      expect(output.entries[0].role).toBe("worker");
    });

    test("allows empty entries", () => {
      const output = historyOutputSchema.parse({
        agentAddress: "0x92de3C10764a03B2455d5f4A4b7FCBd0e281Aa92",
        entries: [],
        total: 0,
        freshness: { timestamp: NOW, ageSeconds: 0, stale: false },
      });
      expect(output.entries).toHaveLength(0);
    });

    test("allows null rating", () => {
      const output = historyOutputSchema.parse({
        agentAddress: "0x92de3C10764a03B2455d5f4A4b7FCBd0e281Aa92",
        entries: [
          {
            taskId: "0xabc123",
            role: "requester",
            status: "expired",
            reward: "1000000",
            rating: null,
            counterparty: "0xD4e2DFF8BB35154d53B3381595240BE54A7A93ff",
            completedAt: NOW,
          },
        ],
        total: 1,
        freshness: { timestamp: NOW, ageSeconds: 0, stale: false },
      });
      expect(output.entries[0].rating).toBeNull();
    });
  });

  // --- Trust breakdown endpoint ---

  describe("GET /v1/identity/trust-breakdown", () => {
    test("accepts valid input with defaults", () => {
      const result = trustBreakdownInputSchema.parse({
        agentAddress: "0x92de3C10764a03B2455d5f4A4b7FCBd0e281Aa92",
      });
      expect(result.evidenceDepth).toBe(3);
    });

    test("rejects evidenceDepth over 10", () => {
      expect(() =>
        trustBreakdownInputSchema.parse({
          agentAddress: "0x92de3C10764a03B2455d5f4A4b7FCBd0e281Aa92",
          evidenceDepth: 20,
        })
      ).toThrow();
    });

    test("validates complete trust breakdown output", () => {
      const output = trustBreakdownOutputSchema.parse({
        agentAddress: "0x92de3C10764a03B2455d5f4A4b7FCBd0e281Aa92",
        overallTrustScore: 82,
        components: [
          {
            component: "completion_rate",
            score: 95,
            weight: 0.4,
            dataPoints: 20,
            evidenceUrls: [],
          },
          {
            component: "rating_average",
            score: 78,
            weight: 0.3,
            dataPoints: 15,
            evidenceUrls: ["https://example.com/evidence/1"],
          },
          {
            component: "onchain_identity",
            score: 100,
            weight: 0.2,
            dataPoints: 1,
            evidenceUrls: [],
          },
          {
            component: "dispute_history",
            score: 60,
            weight: 0.1,
            dataPoints: 5,
            evidenceUrls: [],
          },
        ],
        confidence: 0.75,
        freshness: { timestamp: NOW, ageSeconds: 1, stale: false },
      });
      expect(output.components).toHaveLength(4);
      expect(output.overallTrustScore).toBe(82);
    });

    test("component weights can sum to less than 1", () => {
      const output = trustBreakdownOutputSchema.parse({
        agentAddress: "0x92de3C10764a03B2455d5f4A4b7FCBd0e281Aa92",
        overallTrustScore: 50,
        components: [
          { component: "test", score: 50, weight: 0.5, dataPoints: 1 },
        ],
        confidence: 0.3,
        freshness: { timestamp: NOW, ageSeconds: 0, stale: false },
      });
      expect(output.components).toHaveLength(1);
    });
  });

  // --- Error envelope ---

  describe("Error envelope", () => {
    test("validates error response", () => {
      const err = errorSchema.parse({
        error: { code: "AGENT_NOT_FOUND", message: "Agent not registered" },
      });
      expect(err.error.code).toBe("AGENT_NOT_FOUND");
    });
  });
});
