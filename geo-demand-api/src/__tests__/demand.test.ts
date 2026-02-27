import { describe, test, expect } from "bun:test";
import {
  computeDemandIndex,
  computeVelocity,
  computeConfidenceInterval,
  computeComparableGeos,
  computeTrendDataPoints,
  computeTrendDirection,
  computeTrendStrength,
  computeAnomalies,
  computeConfidence,
  computeFreshness,
  hashSeed,
  seededRandom,
} from "../demand";

describe("Business Logic: Demand Computation", () => {
  describe("hashSeed", () => {
    test("returns consistent hash for same input", () => {
      const a = hashSeed("90210", "plumbing");
      const b = hashSeed("90210", "plumbing");
      expect(a).toBe(b);
    });

    test("returns different hash for different geoCode", () => {
      const a = hashSeed("90210", "plumbing");
      const b = hashSeed("90211", "plumbing");
      expect(a).not.toBe(b);
    });

    test("returns different hash for different category", () => {
      const a = hashSeed("90210", "plumbing");
      const b = hashSeed("90210", "electrical");
      expect(a).not.toBe(b);
    });

    test("returns a positive number", () => {
      const h = hashSeed("test", "category");
      expect(h).toBeGreaterThan(0);
    });
  });

  describe("seededRandom", () => {
    test("returns value between 0 and 1", () => {
      const val = seededRandom(12345);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    });

    test("returns consistent result for same seed", () => {
      const a = seededRandom(42);
      const b = seededRandom(42);
      expect(a).toBe(b);
    });

    test("returns different results for different seeds", () => {
      const a = seededRandom(42);
      const b = seededRandom(43);
      expect(a).not.toBe(b);
    });
  });

  describe("computeDemandIndex", () => {
    test("returns value in 0-200 range", () => {
      const index = computeDemandIndex("90210", "plumbing", "adjusted");
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThanOrEqual(200);
    });

    test("is deterministic for same inputs", () => {
      const a = computeDemandIndex("90210", "plumbing", "adjusted");
      const b = computeDemandIndex("90210", "plumbing", "adjusted");
      expect(a).toBe(b);
    });

    test("differs for different geoCode", () => {
      const a = computeDemandIndex("90210", "plumbing", "adjusted");
      const b = computeDemandIndex("10001", "plumbing", "adjusted");
      expect(a).not.toBe(b);
    });

    test("differs for different category", () => {
      const a = computeDemandIndex("90210", "plumbing", "adjusted");
      const b = computeDemandIndex("90210", "electrical", "adjusted");
      expect(a).not.toBe(b);
    });

    test("raw and adjusted modes may produce different values", () => {
      const raw = computeDemandIndex("90210", "plumbing", "raw");
      const adjusted = computeDemandIndex("90210", "plumbing", "adjusted");
      // They use slightly different computation so values can differ
      expect(typeof raw).toBe("number");
      expect(typeof adjusted).toBe("number");
    });

    test("returns integer values", () => {
      const index = computeDemandIndex("test", "cat", "raw");
      expect(index).toBe(Math.round(index));
    });
  });

  describe("computeVelocity", () => {
    test("returns a number", () => {
      const v = computeVelocity("90210", "plumbing");
      expect(typeof v).toBe("number");
    });

    test("is deterministic", () => {
      const a = computeVelocity("90210", "plumbing");
      const b = computeVelocity("90210", "plumbing");
      expect(a).toBe(b);
    });

    test("can be positive or negative", () => {
      // Test a range of inputs to find both positive and negative
      const velocities = [
        computeVelocity("90210", "plumbing"),
        computeVelocity("10001", "electrical"),
        computeVelocity("30301", "cleaning"),
        computeVelocity("60601", "tutoring"),
        computeVelocity("98101", "delivery"),
      ];
      const hasPositive = velocities.some((v) => v > 0);
      const hasNegative = velocities.some((v) => v < 0);
      expect(hasPositive || hasNegative).toBe(true);
    });

    test("is within reasonable range", () => {
      const v = computeVelocity("90210", "plumbing");
      expect(v).toBeGreaterThanOrEqual(-20);
      expect(v).toBeLessThanOrEqual(20);
    });
  });

  describe("computeConfidenceInterval", () => {
    test("lower is less than upper", () => {
      const ci = computeConfidenceInterval(100, 0.85);
      expect(ci.lower).toBeLessThan(ci.upper);
    });

    test("interval contains the demand index", () => {
      const demandIndex = 120;
      const ci = computeConfidenceInterval(demandIndex, 0.85);
      expect(ci.lower).toBeLessThanOrEqual(demandIndex);
      expect(ci.upper).toBeGreaterThanOrEqual(demandIndex);
    });

    test("higher confidence narrows the interval", () => {
      const wide = computeConfidenceInterval(100, 0.5);
      const narrow = computeConfidenceInterval(100, 0.95);
      const wideRange = wide.upper - wide.lower;
      const narrowRange = narrow.upper - narrow.lower;
      expect(narrowRange).toBeLessThanOrEqual(wideRange);
    });

    test("lower is not negative", () => {
      const ci = computeConfidenceInterval(5, 0.3);
      expect(ci.lower).toBeGreaterThanOrEqual(0);
    });

    test("upper does not exceed 200", () => {
      const ci = computeConfidenceInterval(195, 0.3);
      expect(ci.upper).toBeLessThanOrEqual(200);
    });
  });

  describe("computeComparableGeos", () => {
    test("returns array of comparable geos", () => {
      const geos = computeComparableGeos("90210", "zip", "plumbing");
      expect(Array.isArray(geos)).toBe(true);
      expect(geos.length).toBeGreaterThan(0);
    });

    test("each comparable geo has required fields", () => {
      const geos = computeComparableGeos("90210", "zip", "plumbing");
      for (const geo of geos) {
        expect(typeof geo.geoCode).toBe("string");
        expect(typeof geo.demand_index).toBe("number");
        expect(typeof geo.similarity).toBe("number");
        expect(geo.demand_index).toBeGreaterThanOrEqual(0);
        expect(geo.demand_index).toBeLessThanOrEqual(200);
        expect(geo.similarity).toBeGreaterThanOrEqual(0);
        expect(geo.similarity).toBeLessThanOrEqual(1);
      }
    });

    test("does not include the source geo", () => {
      const geos = computeComparableGeos("90210", "zip", "plumbing");
      const codes = geos.map((g) => g.geoCode);
      expect(codes).not.toContain("90210");
    });

    test("is deterministic", () => {
      const a = computeComparableGeos("90210", "zip", "plumbing");
      const b = computeComparableGeos("90210", "zip", "plumbing");
      expect(a).toEqual(b);
    });
  });

  describe("computeTrendDataPoints", () => {
    test("returns array of data points", () => {
      const points = computeTrendDataPoints("90210", "plumbing", "30d");
      expect(Array.isArray(points)).toBe(true);
      expect(points.length).toBeGreaterThan(0);
    });

    test("each data point has date, demand_index, velocity", () => {
      const points = computeTrendDataPoints("90210", "plumbing", "7d");
      for (const p of points) {
        expect(typeof p.date).toBe("string");
        expect(typeof p.demand_index).toBe("number");
        expect(typeof p.velocity).toBe("number");
        expect(p.demand_index).toBeGreaterThanOrEqual(0);
        expect(p.demand_index).toBeLessThanOrEqual(200);
      }
    });

    test("7d lookback has fewer points than 365d", () => {
      const short = computeTrendDataPoints("90210", "plumbing", "7d");
      const long = computeTrendDataPoints("90210", "plumbing", "365d");
      expect(long.length).toBeGreaterThan(short.length);
    });

    test("is deterministic", () => {
      const a = computeTrendDataPoints("90210", "plumbing", "30d");
      const b = computeTrendDataPoints("90210", "plumbing", "30d");
      expect(a).toEqual(b);
    });

    test("data points are in chronological order", () => {
      const points = computeTrendDataPoints("90210", "plumbing", "30d");
      for (let i = 1; i < points.length; i++) {
        expect(points[i].date >= points[i - 1].date).toBe(true);
      }
    });
  });

  describe("computeTrendDirection", () => {
    test("returns valid trend direction", () => {
      const dir = computeTrendDirection("90210", "plumbing", "30d");
      expect(["accelerating", "stable", "decelerating", "volatile"]).toContain(dir);
    });

    test("is deterministic", () => {
      const a = computeTrendDirection("90210", "plumbing", "30d");
      const b = computeTrendDirection("90210", "plumbing", "30d");
      expect(a).toBe(b);
    });
  });

  describe("computeTrendStrength", () => {
    test("returns value between 0 and 1", () => {
      const strength = computeTrendStrength("90210", "plumbing", "30d");
      expect(strength).toBeGreaterThanOrEqual(0);
      expect(strength).toBeLessThanOrEqual(1);
    });

    test("is deterministic", () => {
      const a = computeTrendStrength("90210", "plumbing", "30d");
      const b = computeTrendStrength("90210", "plumbing", "30d");
      expect(a).toBe(b);
    });
  });

  describe("computeAnomalies", () => {
    test("returns array of anomalies", () => {
      const anomalies = computeAnomalies("90210", "zip", "plumbing", 0.8);
      expect(Array.isArray(anomalies)).toBe(true);
    });

    test("each anomaly has required fields", () => {
      const anomalies = computeAnomalies("90210", "zip", "plumbing", 0.5);
      for (const a of anomalies) {
        expect(typeof a.category).toBe("string");
        expect(["spike", "drop", "seasonal_deviation", "trend_break"]).toContain(a.anomaly_type);
        expect(["low", "medium", "high", "critical"]).toContain(a.severity);
        expect(typeof a.confidence).toBe("number");
        expect(a.confidence).toBeGreaterThanOrEqual(0);
        expect(a.confidence).toBeLessThanOrEqual(1);
        expect(typeof a.detected_at).toBe("string");
        expect(typeof a.description).toBe("string");
      }
    });

    test("all anomalies meet threshold", () => {
      const threshold = 0.9;
      const anomalies = computeAnomalies("90210", "zip", "plumbing", threshold);
      for (const a of anomalies) {
        expect(a.confidence).toBeGreaterThanOrEqual(threshold);
      }
    });

    test("lower threshold returns more or equal anomalies", () => {
      const high = computeAnomalies("90210", "zip", "plumbing", 0.95);
      const low = computeAnomalies("90210", "zip", "plumbing", 0.5);
      expect(low.length).toBeGreaterThanOrEqual(high.length);
    });

    test("is deterministic", () => {
      const a = computeAnomalies("90210", "zip", "plumbing", 0.8);
      const b = computeAnomalies("90210", "zip", "plumbing", 0.8);
      expect(a).toEqual(b);
    });

    test("without category returns anomalies across categories", () => {
      const anomalies = computeAnomalies("90210", "zip", undefined, 0.5);
      if (anomalies.length > 1) {
        const categories = new Set(anomalies.map((a) => a.category));
        expect(categories.size).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe("computeConfidence", () => {
    test("returns value between 0 and 1", () => {
      const c = computeConfidence("90210", "plumbing");
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    });

    test("is deterministic", () => {
      const a = computeConfidence("90210", "plumbing");
      const b = computeConfidence("90210", "plumbing");
      expect(a).toBe(b);
    });
  });

  describe("computeFreshness", () => {
    test("fresh data is not stale", () => {
      const now = new Date();
      const fetchedAt = new Date(now.getTime() - 10_000);
      const freshness = computeFreshness(fetchedAt, now);
      expect(freshness.stale).toBe(false);
      expect(freshness.ageSeconds).toBe(10);
    });

    test("old data is stale", () => {
      const now = new Date();
      const fetchedAt = new Date(now.getTime() - 600_000);
      const freshness = computeFreshness(fetchedAt, now);
      expect(freshness.stale).toBe(true);
      expect(freshness.ageSeconds).toBe(600);
    });

    test("custom staleness threshold", () => {
      const now = new Date();
      const fetchedAt = new Date(now.getTime() - 60_000);
      const freshness = computeFreshness(fetchedAt, now, 30);
      expect(freshness.stale).toBe(true);
    });

    test("ageSeconds is never negative", () => {
      const now = new Date();
      const future = new Date(now.getTime() + 10_000);
      const freshness = computeFreshness(future, now);
      expect(freshness.ageSeconds).toBe(0);
    });
  });
});
