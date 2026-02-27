import { describe, test, expect } from "bun:test";
import {
  computeTrustScore,
  computeTrustComponents,
  computeConfidence,
  computeFreshness,
  computeCompletionRate,
  computeDisputeRate,
  getIdentityState,
  DEFAULT_CONFIG,
  type AgentData,
} from "../scoring";

const makeAgent = (overrides: Partial<AgentData> = {}): AgentData => ({
  registered: true,
  completedTasks: 10,
  ratedTasks: 8,
  totalStars: 680,
  averageRating: 85,
  totalEarnings: "10000000",
  skills: ["api", "typescript"],
  recentRatings: [],
  ...overrides,
});

describe("Business Logic: Scoring", () => {
  describe("computeTrustScore", () => {
    test("returns weighted score for active agent", () => {
      const agent = makeAgent();
      const score = computeTrustScore(agent);
      // completion: 100*0.4=40, rating: 85*0.3=25.5, identity: 100*0.2=20, dispute: 100*0.1=10
      expect(score).toBe(95.5);
    });

    test("returns 0 for agent with no activity and no identity", () => {
      const agent = makeAgent({
        registered: false,
        completedTasks: 0,
        ratedTasks: 0,
        averageRating: 0,
      });
      const score = computeTrustScore(agent);
      // completion: 0, rating: 0, identity: 0, dispute: 100*0.1=10
      expect(score).toBe(10);
    });

    test("unregistered agent loses identity component", () => {
      const registered = computeTrustScore(makeAgent({ registered: true }));
      const unregistered = computeTrustScore(makeAgent({ registered: false }));
      expect(registered).toBeGreaterThan(unregistered);
      expect(registered - unregistered).toBe(20); // 100 * 0.2 weight
    });

    test("higher rating yields higher score", () => {
      const high = computeTrustScore(makeAgent({ averageRating: 95 }));
      const low = computeTrustScore(makeAgent({ averageRating: 50 }));
      expect(high).toBeGreaterThan(low);
    });
  });

  describe("computeTrustComponents", () => {
    test("returns 4 components", () => {
      const components = computeTrustComponents(makeAgent());
      expect(components).toHaveLength(4);
    });

    test("component names match expected", () => {
      const components = computeTrustComponents(makeAgent());
      const names = components.map((c) => c.component);
      expect(names).toContain("completion_rate");
      expect(names).toContain("rating_average");
      expect(names).toContain("onchain_identity");
      expect(names).toContain("dispute_history");
    });

    test("weights match config", () => {
      const components = computeTrustComponents(makeAgent());
      const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
      expect(totalWeight).toBeCloseTo(1.0, 5);
    });

    test("scores are within 0-100 range", () => {
      const components = computeTrustComponents(makeAgent());
      for (const c of components) {
        expect(c.score).toBeGreaterThanOrEqual(0);
        expect(c.score).toBeLessThanOrEqual(100);
      }
    });

    test("custom weights are respected", () => {
      const config = {
        ...DEFAULT_CONFIG,
        weights: { completionRate: 1.0, ratingAverage: 0, onchainIdentity: 0, disputeHistory: 0 },
      };
      const components = computeTrustComponents(makeAgent(), config);
      const completionComp = components.find((c) => c.component === "completion_rate");
      expect(completionComp?.weight).toBe(1.0);
    });
  });

  describe("computeConfidence", () => {
    test("returns 0 for no completed tasks", () => {
      expect(computeConfidence(makeAgent({ completedTasks: 0 }))).toBe(0);
    });

    test("increases with more tasks", () => {
      const few = computeConfidence(makeAgent({ completedTasks: 2, ratedTasks: 1 }));
      const many = computeConfidence(makeAgent({ completedTasks: 50, ratedTasks: 40 }));
      expect(many).toBeGreaterThan(few);
    });

    test("caps at 1.0", () => {
      const max = computeConfidence(makeAgent({ completedTasks: 1000, ratedTasks: 1000 }));
      expect(max).toBeLessThanOrEqual(1.0);
    });

    test("rated tasks increase confidence", () => {
      const noRatings = computeConfidence(makeAgent({ completedTasks: 10, ratedTasks: 0 }));
      const allRated = computeConfidence(makeAgent({ completedTasks: 10, ratedTasks: 10 }));
      expect(allRated).toBeGreaterThan(noRatings);
    });
  });

  describe("computeFreshness", () => {
    test("fresh data is not stale", () => {
      const now = new Date();
      const fetchedAt = new Date(now.getTime() - 10_000); // 10 seconds ago
      const freshness = computeFreshness(fetchedAt, now);
      expect(freshness.stale).toBe(false);
      expect(freshness.ageSeconds).toBe(10);
    });

    test("old data is stale", () => {
      const now = new Date();
      const fetchedAt = new Date(now.getTime() - 600_000); // 10 minutes ago
      const freshness = computeFreshness(fetchedAt, now);
      expect(freshness.stale).toBe(true);
      expect(freshness.ageSeconds).toBe(600);
    });

    test("custom staleness threshold", () => {
      const now = new Date();
      const fetchedAt = new Date(now.getTime() - 60_000); // 1 minute ago
      const freshness = computeFreshness(fetchedAt, now, 30); // 30s threshold
      expect(freshness.stale).toBe(true);
    });

    test("ageSeconds is never negative", () => {
      const now = new Date();
      const future = new Date(now.getTime() + 10_000);
      const freshness = computeFreshness(future, now);
      expect(freshness.ageSeconds).toBe(0);
    });
  });

  describe("computeCompletionRate", () => {
    test("returns 0 for no tasks", () => {
      expect(computeCompletionRate(makeAgent({ completedTasks: 0 }))).toBe(0);
    });

    test("returns 1.0 for agent with completed tasks", () => {
      expect(computeCompletionRate(makeAgent({ completedTasks: 5 }))).toBe(1.0);
    });
  });

  describe("computeDisputeRate", () => {
    test("returns 0 (no dispute data available)", () => {
      expect(computeDisputeRate(makeAgent())).toBe(0);
    });
  });

  describe("getIdentityState", () => {
    test("registered", () => {
      expect(getIdentityState(true)).toBe("registered");
    });

    test("unregistered", () => {
      expect(getIdentityState(false)).toBe("unregistered");
    });
  });
});
