import { describe, test, expect } from "bun:test";
import {
  demandIndexInputSchema,
  demandIndexOutputSchema,
  trendInputSchema,
  trendOutputSchema,
  anomalyInputSchema,
  anomalyOutputSchema,
  freshnessSchema,
  errorSchema,
} from "../schemas";

const NOW = new Date().toISOString();

describe("Contract Tests: Request/Response Schemas", () => {
  // --- Demand Index endpoint ---

  describe("GET /v1/demand/index", () => {
    test("accepts valid input with all fields", () => {
      const result = demandIndexInputSchema.parse({
        geoType: "zip",
        geoCode: "90210",
        category: "plumbing",
        seasonalityMode: "raw",
      });
      expect(result.geoType).toBe("zip");
      expect(result.geoCode).toBe("90210");
      expect(result.category).toBe("plumbing");
      expect(result.seasonalityMode).toBe("raw");
    });

    test("applies default seasonalityMode", () => {
      const result = demandIndexInputSchema.parse({
        geoType: "city",
        geoCode: "new-york",
        category: "electrical",
      });
      expect(result.seasonalityMode).toBe("adjusted");
    });

    test("accepts all valid geoType values", () => {
      for (const geoType of ["zip", "city", "state", "country"]) {
        const result = demandIndexInputSchema.parse({
          geoType,
          geoCode: "test",
          category: "cleaning",
        });
        expect(result.geoType).toBe(geoType);
      }
    });

    test("rejects invalid geoType", () => {
      expect(() =>
        demandIndexInputSchema.parse({
          geoType: "region",
          geoCode: "test",
          category: "cleaning",
        })
      ).toThrow();
    });

    test("rejects missing geoCode", () => {
      expect(() =>
        demandIndexInputSchema.parse({
          geoType: "zip",
          category: "plumbing",
        })
      ).toThrow();
    });

    test("rejects missing category", () => {
      expect(() =>
        demandIndexInputSchema.parse({
          geoType: "zip",
          geoCode: "90210",
        })
      ).toThrow();
    });

    test("rejects missing geoType", () => {
      expect(() =>
        demandIndexInputSchema.parse({
          geoCode: "90210",
          category: "plumbing",
        })
      ).toThrow();
    });

    test("rejects invalid seasonalityMode", () => {
      expect(() =>
        demandIndexInputSchema.parse({
          geoType: "zip",
          geoCode: "90210",
          category: "plumbing",
          seasonalityMode: "smooth",
        })
      ).toThrow();
    });

    test("validates complete demand index output", () => {
      const output = demandIndexOutputSchema.parse({
        geoType: "zip",
        geoCode: "90210",
        category: "plumbing",
        demand_index: 142,
        velocity: 3.5,
        confidence_interval: { lower: 130, upper: 155 },
        comparable_geos: [
          { geoCode: "90211", demand_index: 138, similarity: 0.92 },
        ],
        confidence: 0.85,
        freshness: { timestamp: NOW, ageSeconds: 2, stale: false },
      });
      expect(output.demand_index).toBe(142);
      expect(output.velocity).toBe(3.5);
      expect(output.comparable_geos).toHaveLength(1);
    });

    test("rejects demand_index below 0", () => {
      expect(() =>
        demandIndexOutputSchema.parse({
          geoType: "zip",
          geoCode: "90210",
          category: "plumbing",
          demand_index: -5,
          velocity: 0,
          confidence_interval: { lower: 0, upper: 10 },
          comparable_geos: [],
          confidence: 0.5,
          freshness: { timestamp: NOW, ageSeconds: 0, stale: false },
        })
      ).toThrow();
    });

    test("rejects demand_index above 200", () => {
      expect(() =>
        demandIndexOutputSchema.parse({
          geoType: "zip",
          geoCode: "90210",
          category: "plumbing",
          demand_index: 250,
          velocity: 0,
          confidence_interval: { lower: 190, upper: 210 },
          comparable_geos: [],
          confidence: 0.5,
          freshness: { timestamp: NOW, ageSeconds: 0, stale: false },
        })
      ).toThrow();
    });

    test("allows negative velocity", () => {
      const output = demandIndexOutputSchema.parse({
        geoType: "state",
        geoCode: "CA",
        category: "landscaping",
        demand_index: 80,
        velocity: -2.3,
        confidence_interval: { lower: 70, upper: 90 },
        comparable_geos: [],
        confidence: 0.7,
        freshness: { timestamp: NOW, ageSeconds: 0, stale: false },
      });
      expect(output.velocity).toBe(-2.3);
    });

    test("rejects confidence out of range", () => {
      expect(() =>
        demandIndexOutputSchema.parse({
          geoType: "zip",
          geoCode: "90210",
          category: "plumbing",
          demand_index: 100,
          velocity: 0,
          confidence_interval: { lower: 90, upper: 110 },
          comparable_geos: [],
          confidence: 1.5,
          freshness: { timestamp: NOW, ageSeconds: 0, stale: false },
        })
      ).toThrow();
    });

    test("requires freshness in output", () => {
      expect(() =>
        demandIndexOutputSchema.parse({
          geoType: "zip",
          geoCode: "90210",
          category: "plumbing",
          demand_index: 100,
          velocity: 0,
          confidence_interval: { lower: 90, upper: 110 },
          comparable_geos: [],
          confidence: 0.8,
        })
      ).toThrow();
    });

    test("validates comparable_geos structure", () => {
      const output = demandIndexOutputSchema.parse({
        geoType: "city",
        geoCode: "los-angeles",
        category: "tutoring",
        demand_index: 120,
        velocity: 1.2,
        confidence_interval: { lower: 110, upper: 130 },
        comparable_geos: [
          { geoCode: "san-francisco", demand_index: 115, similarity: 0.88 },
          { geoCode: "san-diego", demand_index: 105, similarity: 0.75 },
        ],
        confidence: 0.9,
        freshness: { timestamp: NOW, ageSeconds: 1, stale: false },
      });
      expect(output.comparable_geos).toHaveLength(2);
      expect(output.comparable_geos[0].similarity).toBe(0.88);
    });

    test("rejects similarity out of 0-1 range", () => {
      expect(() =>
        demandIndexOutputSchema.parse({
          geoType: "city",
          geoCode: "test",
          category: "test",
          demand_index: 100,
          velocity: 0,
          confidence_interval: { lower: 90, upper: 110 },
          comparable_geos: [
            { geoCode: "other", demand_index: 100, similarity: 1.5 },
          ],
          confidence: 0.5,
          freshness: { timestamp: NOW, ageSeconds: 0, stale: false },
        })
      ).toThrow();
    });

    test("allows empty comparable_geos array", () => {
      const output = demandIndexOutputSchema.parse({
        geoType: "country",
        geoCode: "US",
        category: "coding",
        demand_index: 100,
        velocity: 0,
        confidence_interval: { lower: 95, upper: 105 },
        comparable_geos: [],
        confidence: 0.6,
        freshness: { timestamp: NOW, ageSeconds: 0, stale: false },
      });
      expect(output.comparable_geos).toHaveLength(0);
    });
  });

  // --- Trend endpoint ---

  describe("GET /v1/demand/trend", () => {
    test("accepts valid input with all fields", () => {
      const result = trendInputSchema.parse({
        geoType: "state",
        geoCode: "CA",
        category: "plumbing",
        lookbackWindow: "90d",
      });
      expect(result.lookbackWindow).toBe("90d");
    });

    test("applies default lookbackWindow", () => {
      const result = trendInputSchema.parse({
        geoType: "city",
        geoCode: "seattle",
        category: "cleaning",
      });
      expect(result.lookbackWindow).toBe("30d");
    });

    test("accepts all valid lookbackWindow values", () => {
      for (const window of ["7d", "30d", "90d", "365d"]) {
        const result = trendInputSchema.parse({
          geoType: "zip",
          geoCode: "10001",
          category: "delivery",
          lookbackWindow: window,
        });
        expect(result.lookbackWindow).toBe(window);
      }
    });

    test("rejects invalid lookbackWindow", () => {
      expect(() =>
        trendInputSchema.parse({
          geoType: "city",
          geoCode: "test",
          category: "test",
          lookbackWindow: "14d",
        })
      ).toThrow();
    });

    test("rejects missing required fields", () => {
      expect(() =>
        trendInputSchema.parse({
          geoType: "city",
          category: "test",
        })
      ).toThrow();
    });

    test("validates complete trend output", () => {
      const output = trendOutputSchema.parse({
        geoType: "city",
        geoCode: "seattle",
        category: "plumbing",
        lookbackWindow: "30d",
        data_points: [
          { date: "2026-02-01", demand_index: 98, velocity: -0.5 },
          { date: "2026-02-15", demand_index: 105, velocity: 1.2 },
        ],
        trend_direction: "accelerating",
        trend_strength: 0.72,
        freshness: { timestamp: NOW, ageSeconds: 3, stale: false },
      });
      expect(output.data_points).toHaveLength(2);
      expect(output.trend_direction).toBe("accelerating");
    });

    test("rejects invalid trend_direction", () => {
      expect(() =>
        trendOutputSchema.parse({
          geoType: "city",
          geoCode: "seattle",
          category: "plumbing",
          lookbackWindow: "30d",
          data_points: [],
          trend_direction: "unknown",
          trend_strength: 0.5,
          freshness: { timestamp: NOW, ageSeconds: 0, stale: false },
        })
      ).toThrow();
    });

    test("rejects trend_strength out of range", () => {
      expect(() =>
        trendOutputSchema.parse({
          geoType: "city",
          geoCode: "seattle",
          category: "plumbing",
          lookbackWindow: "30d",
          data_points: [],
          trend_direction: "stable",
          trend_strength: 1.5,
          freshness: { timestamp: NOW, ageSeconds: 0, stale: false },
        })
      ).toThrow();
    });

    test("allows all valid trend_direction values", () => {
      for (const dir of ["accelerating", "stable", "decelerating", "volatile"]) {
        const output = trendOutputSchema.parse({
          geoType: "zip",
          geoCode: "10001",
          category: "delivery",
          lookbackWindow: "7d",
          data_points: [],
          trend_direction: dir,
          trend_strength: 0.5,
          freshness: { timestamp: NOW, ageSeconds: 0, stale: false },
        });
        expect(output.trend_direction).toBe(dir);
      }
    });

    test("allows empty data_points", () => {
      const output = trendOutputSchema.parse({
        geoType: "state",
        geoCode: "NY",
        category: "tutoring",
        lookbackWindow: "7d",
        data_points: [],
        trend_direction: "stable",
        trend_strength: 0,
        freshness: { timestamp: NOW, ageSeconds: 0, stale: false },
      });
      expect(output.data_points).toHaveLength(0);
    });

    test("requires freshness in trend output", () => {
      expect(() =>
        trendOutputSchema.parse({
          geoType: "city",
          geoCode: "seattle",
          category: "plumbing",
          lookbackWindow: "30d",
          data_points: [],
          trend_direction: "stable",
          trend_strength: 0.5,
        })
      ).toThrow();
    });
  });

  // --- Anomaly endpoint ---

  describe("GET /v1/demand/anomalies", () => {
    test("accepts valid input with all fields", () => {
      const result = anomalyInputSchema.parse({
        geoType: "zip",
        geoCode: "90210",
        category: "plumbing",
        threshold: 0.9,
      });
      expect(result.threshold).toBe(0.9);
      expect(result.category).toBe("plumbing");
    });

    test("applies default threshold", () => {
      const result = anomalyInputSchema.parse({
        geoType: "city",
        geoCode: "denver",
      });
      expect(result.threshold).toBe(0.8);
    });

    test("category is optional", () => {
      const result = anomalyInputSchema.parse({
        geoType: "state",
        geoCode: "TX",
      });
      expect(result.category).toBeUndefined();
    });

    test("rejects threshold below 0", () => {
      expect(() =>
        anomalyInputSchema.parse({
          geoType: "city",
          geoCode: "test",
          threshold: -0.1,
        })
      ).toThrow();
    });

    test("rejects threshold above 1", () => {
      expect(() =>
        anomalyInputSchema.parse({
          geoType: "city",
          geoCode: "test",
          threshold: 1.5,
        })
      ).toThrow();
    });

    test("validates complete anomaly output", () => {
      const output = anomalyOutputSchema.parse({
        geoType: "zip",
        geoCode: "90210",
        anomalies: [
          {
            category: "plumbing",
            anomaly_type: "spike",
            severity: "high",
            confidence: 0.95,
            detected_at: NOW,
            description: "Demand spike detected: 180% above baseline",
          },
        ],
        total_anomalies: 1,
        freshness: { timestamp: NOW, ageSeconds: 1, stale: false },
      });
      expect(output.anomalies).toHaveLength(1);
      expect(output.total_anomalies).toBe(1);
    });

    test("allows all valid anomaly_type values", () => {
      for (const type of ["spike", "drop", "seasonal_deviation", "trend_break"]) {
        const output = anomalyOutputSchema.parse({
          geoType: "city",
          geoCode: "test",
          anomalies: [
            {
              category: "test",
              anomaly_type: type,
              severity: "low",
              confidence: 0.85,
              detected_at: NOW,
              description: "Test anomaly",
            },
          ],
          total_anomalies: 1,
          freshness: { timestamp: NOW, ageSeconds: 0, stale: false },
        });
        expect(output.anomalies[0].anomaly_type).toBe(type);
      }
    });

    test("allows all valid severity values", () => {
      for (const sev of ["low", "medium", "high", "critical"]) {
        const output = anomalyOutputSchema.parse({
          geoType: "city",
          geoCode: "test",
          anomalies: [
            {
              category: "test",
              anomaly_type: "spike",
              severity: sev,
              confidence: 0.9,
              detected_at: NOW,
              description: "Test",
            },
          ],
          total_anomalies: 1,
          freshness: { timestamp: NOW, ageSeconds: 0, stale: false },
        });
        expect(output.anomalies[0].severity).toBe(sev);
      }
    });

    test("allows empty anomalies array", () => {
      const output = anomalyOutputSchema.parse({
        geoType: "state",
        geoCode: "WA",
        anomalies: [],
        total_anomalies: 0,
        freshness: { timestamp: NOW, ageSeconds: 0, stale: false },
      });
      expect(output.anomalies).toHaveLength(0);
    });

    test("rejects invalid anomaly_type", () => {
      expect(() =>
        anomalyOutputSchema.parse({
          geoType: "city",
          geoCode: "test",
          anomalies: [
            {
              category: "test",
              anomaly_type: "unknown",
              severity: "low",
              confidence: 0.5,
              detected_at: NOW,
              description: "Test",
            },
          ],
          total_anomalies: 1,
          freshness: { timestamp: NOW, ageSeconds: 0, stale: false },
        })
      ).toThrow();
    });

    test("requires freshness in anomaly output", () => {
      expect(() =>
        anomalyOutputSchema.parse({
          geoType: "city",
          geoCode: "test",
          anomalies: [],
          total_anomalies: 0,
        })
      ).toThrow();
    });
  });

  // --- Freshness schema ---

  describe("Freshness schema", () => {
    test("validates valid freshness", () => {
      const f = freshnessSchema.parse({
        timestamp: NOW,
        ageSeconds: 5,
        stale: false,
      });
      expect(f.ageSeconds).toBe(5);
    });

    test("rejects negative ageSeconds", () => {
      expect(() =>
        freshnessSchema.parse({
          timestamp: NOW,
          ageSeconds: -1,
          stale: false,
        })
      ).toThrow();
    });

    test("requires valid datetime timestamp", () => {
      expect(() =>
        freshnessSchema.parse({
          timestamp: "not-a-date",
          ageSeconds: 0,
          stale: false,
        })
      ).toThrow();
    });
  });

  // --- Error envelope ---

  describe("Error envelope", () => {
    test("validates error response", () => {
      const err = errorSchema.parse({
        error: { code: "VALIDATION_ERROR", message: "Invalid input" },
      });
      expect(err.error.code).toBe("VALIDATION_ERROR");
    });

    test("validates not found error", () => {
      const err = errorSchema.parse({
        error: { code: "NOT_FOUND", message: "Geo not found" },
      });
      expect(err.error.code).toBe("NOT_FOUND");
    });
  });
});
