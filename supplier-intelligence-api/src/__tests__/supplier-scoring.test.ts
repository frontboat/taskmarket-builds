import { describe, test, expect } from "bun:test";
import {
  hashSupplierId,
  seededRandom,
  computeFreshness,
  computeFillRate,
  computeOnTimeRate,
  computeDefectRate,
  computeConfidence,
  computeRiskFactors,
  computeReliabilityGrade,
  computeSupplierScore,
  computeLeadTimeForecast,
  buildDisruptionAlerts,
  filterAlertsByRiskTolerance,
  generateSupplierData,
  DEFAULT_CONFIG,
  type SupplierData,
} from "../supplier-scoring";

// --- Helper to build SupplierData ---

function makeSupplier(overrides: Partial<SupplierData> = {}): SupplierData {
  return {
    supplierId: "SUP-TEST",
    totalOrders: 100,
    fulfilledOrders: 95,
    onTimeOrders: 90,
    defectiveOrders: 2,
    avgLeadTimeDays: 7,
    leadTimeStdDev: 2,
    categories: ["electronics"],
    regions: ["north_america"],
    activeAlerts: [],
    ...overrides,
  };
}

// --- hashSupplierId ---

describe("hashSupplierId", () => {
  test("returns a non-negative number", () => {
    expect(hashSupplierId("SUP-001")).toBeGreaterThanOrEqual(0);
  });

  test("is deterministic", () => {
    expect(hashSupplierId("SUP-001")).toBe(hashSupplierId("SUP-001"));
  });

  test("produces different hashes for different IDs", () => {
    expect(hashSupplierId("SUP-001")).not.toBe(hashSupplierId("SUP-002"));
  });

  test("handles empty string", () => {
    expect(hashSupplierId("")).toBe(0);
  });
});

// --- seededRandom ---

describe("seededRandom", () => {
  test("returns values between 0 and 1", () => {
    const rng = seededRandom(42);
    for (let i = 0; i < 100; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    }
  });

  test("is deterministic with same seed", () => {
    const rng1 = seededRandom(42);
    const rng2 = seededRandom(42);
    for (let i = 0; i < 10; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  test("produces different sequences for different seeds", () => {
    const rng1 = seededRandom(42);
    const rng2 = seededRandom(99);
    const seq1 = Array.from({ length: 5 }, () => rng1());
    const seq2 = Array.from({ length: 5 }, () => rng2());
    expect(seq1).not.toEqual(seq2);
  });
});

// --- computeFreshness ---

describe("computeFreshness", () => {
  test("returns zero age for same time", () => {
    const now = new Date("2024-01-15T10:30:00.000Z");
    const freshness = computeFreshness(now, now);
    expect(freshness.ageSeconds).toBe(0);
    expect(freshness.stale).toBe(false);
  });

  test("calculates age correctly", () => {
    const fetchedAt = new Date("2024-01-15T10:30:00.000Z");
    const now = new Date("2024-01-15T10:31:00.000Z");
    const freshness = computeFreshness(fetchedAt, now);
    expect(freshness.ageSeconds).toBe(60);
  });

  test("marks as stale when beyond threshold", () => {
    const fetchedAt = new Date("2024-01-15T10:00:00.000Z");
    const now = new Date("2024-01-15T10:10:00.000Z");
    const freshness = computeFreshness(fetchedAt, now);
    expect(freshness.stale).toBe(true);
  });

  test("not stale within threshold", () => {
    const fetchedAt = new Date("2024-01-15T10:00:00.000Z");
    const now = new Date("2024-01-15T10:04:00.000Z");
    const freshness = computeFreshness(fetchedAt, now);
    expect(freshness.stale).toBe(false);
  });

  test("respects custom staleness threshold", () => {
    const fetchedAt = new Date("2024-01-15T10:00:00.000Z");
    const now = new Date("2024-01-15T10:01:00.000Z");
    const freshness = computeFreshness(fetchedAt, now, 30);
    expect(freshness.stale).toBe(true);
  });

  test("timestamp is ISO format", () => {
    const now = new Date("2024-01-15T10:30:00.000Z");
    const freshness = computeFreshness(now, now);
    expect(freshness.timestamp).toBe("2024-01-15T10:30:00.000Z");
  });
});

// --- computeFillRate ---

describe("computeFillRate", () => {
  test("returns 0 for zero orders", () => {
    expect(computeFillRate(makeSupplier({ totalOrders: 0, fulfilledOrders: 0 }))).toBe(0);
  });

  test("returns 1 for all fulfilled", () => {
    expect(computeFillRate(makeSupplier({ totalOrders: 100, fulfilledOrders: 100 }))).toBe(1);
  });

  test("calculates correctly", () => {
    expect(computeFillRate(makeSupplier({ totalOrders: 100, fulfilledOrders: 80 }))).toBe(0.8);
  });

  test("rounds to 2 decimal places", () => {
    expect(computeFillRate(makeSupplier({ totalOrders: 3, fulfilledOrders: 1 }))).toBe(0.33);
  });
});

// --- computeOnTimeRate ---

describe("computeOnTimeRate", () => {
  test("returns 0 for zero fulfilled", () => {
    expect(computeOnTimeRate(makeSupplier({ fulfilledOrders: 0, onTimeOrders: 0 }))).toBe(0);
  });

  test("returns 1 for all on time", () => {
    expect(computeOnTimeRate(makeSupplier({ fulfilledOrders: 50, onTimeOrders: 50 }))).toBe(1);
  });

  test("calculates correctly", () => {
    expect(computeOnTimeRate(makeSupplier({ fulfilledOrders: 100, onTimeOrders: 85 }))).toBe(0.85);
  });
});

// --- computeDefectRate ---

describe("computeDefectRate", () => {
  test("returns 0 for zero fulfilled", () => {
    expect(computeDefectRate(makeSupplier({ fulfilledOrders: 0, defectiveOrders: 0 }))).toBe(0);
  });

  test("returns 0 for no defects", () => {
    expect(computeDefectRate(makeSupplier({ fulfilledOrders: 100, defectiveOrders: 0 }))).toBe(0);
  });

  test("calculates correctly", () => {
    expect(computeDefectRate(makeSupplier({ fulfilledOrders: 100, defectiveOrders: 5 }))).toBe(0.05);
  });
});

// --- computeConfidence ---

describe("computeConfidence", () => {
  test("returns 0 for zero orders", () => {
    expect(computeConfidence(makeSupplier({ totalOrders: 0 }))).toBe(0);
  });

  test("increases with more orders", () => {
    const low = computeConfidence(makeSupplier({ totalOrders: 5, fulfilledOrders: 5 }));
    const high = computeConfidence(makeSupplier({ totalOrders: 500, fulfilledOrders: 500 }));
    expect(high).toBeGreaterThan(low);
  });

  test("returns value between 0 and 1", () => {
    const conf = computeConfidence(makeSupplier({ totalOrders: 50, fulfilledOrders: 45 }));
    expect(conf).toBeGreaterThanOrEqual(0);
    expect(conf).toBeLessThanOrEqual(1);
  });

  test("fulfillment ratio affects confidence", () => {
    const highFill = computeConfidence(makeSupplier({ totalOrders: 100, fulfilledOrders: 100 }));
    const lowFill = computeConfidence(makeSupplier({ totalOrders: 100, fulfilledOrders: 10 }));
    expect(highFill).toBeGreaterThan(lowFill);
  });
});

// --- computeRiskFactors ---

describe("computeRiskFactors", () => {
  test("returns empty for excellent supplier", () => {
    const factors = computeRiskFactors(makeSupplier({
      totalOrders: 200,
      fulfilledOrders: 190,
      onTimeOrders: 180,
      defectiveOrders: 2,
    }));
    expect(factors).toEqual([]);
  });

  test("flags low fill rate", () => {
    const factors = computeRiskFactors(makeSupplier({
      totalOrders: 100,
      fulfilledOrders: 60,
    }));
    expect(factors.some((f) => f.factor === "low_fill_rate")).toBe(true);
  });

  test("flags late deliveries", () => {
    const factors = computeRiskFactors(makeSupplier({
      fulfilledOrders: 100,
      onTimeOrders: 70,
    }));
    expect(factors.some((f) => f.factor === "late_deliveries")).toBe(true);
  });

  test("flags high defect rate", () => {
    const factors = computeRiskFactors(makeSupplier({
      fulfilledOrders: 100,
      defectiveOrders: 10,
    }));
    expect(factors.some((f) => f.factor === "high_defect_rate")).toBe(true);
  });

  test("flags limited history", () => {
    const factors = computeRiskFactors(makeSupplier({ totalOrders: 5 }));
    expect(factors.some((f) => f.factor === "limited_history")).toBe(true);
  });

  test("flags active critical alerts", () => {
    const factors = computeRiskFactors(makeSupplier({
      activeAlerts: [{
        type: "weather",
        severity: "critical",
        probability: 0.9,
        description: "Hurricane approaching",
        detectedAt: new Date().toISOString(),
      }],
    }));
    expect(factors.some((f) => f.factor === "active_weather_alert")).toBe(true);
  });

  test("low fill rate severity is high when below 50%", () => {
    const factors = computeRiskFactors(makeSupplier({
      totalOrders: 100,
      fulfilledOrders: 40,
    }));
    const fillFactor = factors.find((f) => f.factor === "low_fill_rate");
    expect(fillFactor?.severity).toBe("high");
  });

  test("low fill rate severity is medium when between 50-80%", () => {
    const factors = computeRiskFactors(makeSupplier({
      totalOrders: 100,
      fulfilledOrders: 70,
    }));
    const fillFactor = factors.find((f) => f.factor === "low_fill_rate");
    expect(fillFactor?.severity).toBe("medium");
  });
});

// --- computeReliabilityGrade ---

describe("computeReliabilityGrade", () => {
  test("returns A for score >= 90", () => {
    expect(computeReliabilityGrade(90)).toBe("A");
    expect(computeReliabilityGrade(95)).toBe("A");
    expect(computeReliabilityGrade(100)).toBe("A");
  });

  test("returns B for score 75-89", () => {
    expect(computeReliabilityGrade(75)).toBe("B");
    expect(computeReliabilityGrade(89)).toBe("B");
  });

  test("returns C for score 60-74", () => {
    expect(computeReliabilityGrade(60)).toBe("C");
    expect(computeReliabilityGrade(74)).toBe("C");
  });

  test("returns D for score 40-59", () => {
    expect(computeReliabilityGrade(40)).toBe("D");
    expect(computeReliabilityGrade(59)).toBe("D");
  });

  test("returns F for score below 40", () => {
    expect(computeReliabilityGrade(0)).toBe("F");
    expect(computeReliabilityGrade(39)).toBe("F");
  });
});

// --- computeSupplierScore ---

describe("computeSupplierScore", () => {
  test("returns 0-100 range", () => {
    const score = computeSupplierScore(makeSupplier());
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test("perfect supplier gets high score", () => {
    const score = computeSupplierScore(makeSupplier({
      totalOrders: 100,
      fulfilledOrders: 100,
      onTimeOrders: 100,
      defectiveOrders: 0,
    }));
    expect(score).toBeGreaterThanOrEqual(90);
  });

  test("poor supplier gets low score", () => {
    const score = computeSupplierScore(makeSupplier({
      totalOrders: 100,
      fulfilledOrders: 40,
      onTimeOrders: 20,
      defectiveOrders: 15,
    }));
    expect(score).toBeLessThan(60);
  });

  test("critical alerts reduce score", () => {
    const withoutAlerts = computeSupplierScore(makeSupplier());
    const withAlerts = computeSupplierScore(makeSupplier({
      activeAlerts: [
        { type: "weather", severity: "critical", probability: 0.9, description: "Test", detectedAt: new Date().toISOString() },
        { type: "financial", severity: "high", probability: 0.8, description: "Test", detectedAt: new Date().toISOString() },
      ],
    }));
    expect(withAlerts).toBeLessThan(withoutAlerts);
  });

  test("is deterministic", () => {
    const data = makeSupplier();
    expect(computeSupplierScore(data)).toBe(computeSupplierScore(data));
  });
});

// --- computeLeadTimeForecast ---

describe("computeLeadTimeForecast", () => {
  test("p95 is greater than or equal to p50", () => {
    const forecast = computeLeadTimeForecast(makeSupplier(), 30);
    expect(forecast.lead_time_p95).toBeGreaterThanOrEqual(forecast.lead_time_p50);
  });

  test("p50 equals avg lead time", () => {
    const forecast = computeLeadTimeForecast(makeSupplier({ avgLeadTimeDays: 10 }), 30);
    expect(forecast.lead_time_p50).toBe(10);
  });

  test("drift is stable for low variance", () => {
    const forecast = computeLeadTimeForecast(makeSupplier({
      avgLeadTimeDays: 10,
      leadTimeStdDev: 1,
    }), 30);
    expect(forecast.drift_direction).toBe("stable");
  });

  test("drift is degrading for high variance", () => {
    const forecast = computeLeadTimeForecast(makeSupplier({
      avgLeadTimeDays: 10,
      leadTimeStdDev: 5,
    }), 30);
    expect(forecast.drift_direction).toBe("degrading");
  });

  test("drift magnitude is 0-1", () => {
    const forecast = computeLeadTimeForecast(makeSupplier(), 30);
    expect(forecast.drift_magnitude).toBeGreaterThanOrEqual(0);
    expect(forecast.drift_magnitude).toBeLessThanOrEqual(1);
  });

  test("historical variance is non-negative", () => {
    const forecast = computeLeadTimeForecast(makeSupplier(), 30);
    expect(forecast.historical_variance).toBeGreaterThanOrEqual(0);
  });

  test("historical variance is stddev squared", () => {
    const data = makeSupplier({ leadTimeStdDev: 3 });
    const forecast = computeLeadTimeForecast(data, 30);
    expect(forecast.historical_variance).toBe(9);
  });
});

// --- buildDisruptionAlerts ---

describe("buildDisruptionAlerts", () => {
  test("returns empty array when no alerts", () => {
    const alerts = buildDisruptionAlerts(makeSupplier({ activeAlerts: [] }));
    expect(alerts).toHaveLength(0);
  });

  test("maps supplier alerts correctly", () => {
    const data = makeSupplier({
      activeAlerts: [{
        type: "weather",
        severity: "high",
        probability: 0.8,
        description: "Storm approaching",
        detectedAt: "2024-01-15T10:30:00.000Z",
      }],
    });
    const alerts = buildDisruptionAlerts(data);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].supplierId).toBe("SUP-TEST");
    expect(alerts[0].alert_type).toBe("weather");
    expect(alerts[0].severity).toBe("high");
  });

  test("includes supplier categories and regions", () => {
    const data = makeSupplier({
      categories: ["electronics", "packaging"],
      regions: ["asia_pacific"],
      activeAlerts: [{
        type: "logistics",
        severity: "medium",
        probability: 0.5,
        description: "Port congestion",
        detectedAt: "2024-01-15T10:30:00.000Z",
      }],
    });
    const alerts = buildDisruptionAlerts(data);
    expect(alerts[0].affected_categories).toEqual(["electronics", "packaging"]);
    expect(alerts[0].affected_regions).toEqual(["asia_pacific"]);
  });
});

// --- filterAlertsByRiskTolerance ---

describe("filterAlertsByRiskTolerance", () => {
  const alerts = [
    { supplierId: "S1", alert_type: "weather" as const, severity: "low" as const, disruption_probability: 0.05, affected_categories: [], affected_regions: [], detected_at: "2024-01-15T10:30:00.000Z", description: "Minor" },
    { supplierId: "S2", alert_type: "financial" as const, severity: "medium" as const, disruption_probability: 0.35, affected_categories: [], affected_regions: [], detected_at: "2024-01-15T10:30:00.000Z", description: "Moderate" },
    { supplierId: "S3", alert_type: "geopolitical" as const, severity: "high" as const, disruption_probability: 0.75, affected_categories: [], affected_regions: [], detected_at: "2024-01-15T10:30:00.000Z", description: "Severe" },
  ];

  test("low tolerance returns all alerts above 0.1", () => {
    const filtered = filterAlertsByRiskTolerance(alerts, "low");
    expect(filtered).toHaveLength(2);
  });

  test("medium tolerance returns alerts above 0.3", () => {
    const filtered = filterAlertsByRiskTolerance(alerts, "medium");
    expect(filtered).toHaveLength(2);
  });

  test("high tolerance returns only high-probability alerts", () => {
    const filtered = filterAlertsByRiskTolerance(alerts, "high");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].supplierId).toBe("S3");
  });
});

// --- generateSupplierData ---

describe("generateSupplierData", () => {
  test("is deterministic", () => {
    const data1 = generateSupplierData("SUP-001");
    const data2 = generateSupplierData("SUP-001");
    expect(data1).toEqual(data2);
  });

  test("different IDs produce different data", () => {
    const data1 = generateSupplierData("SUP-001");
    const data2 = generateSupplierData("SUP-002");
    expect(data1.totalOrders).not.toBe(data2.totalOrders);
  });

  test("includes supplierId in output", () => {
    const data = generateSupplierData("SUP-XYZ");
    expect(data.supplierId).toBe("SUP-XYZ");
  });

  test("fulfilled orders never exceed total orders", () => {
    for (let i = 0; i < 20; i++) {
      const data = generateSupplierData(`SUP-${i}`);
      expect(data.fulfilledOrders).toBeLessThanOrEqual(data.totalOrders);
    }
  });

  test("on-time orders never exceed fulfilled orders", () => {
    for (let i = 0; i < 20; i++) {
      const data = generateSupplierData(`SUP-${i}`);
      expect(data.onTimeOrders).toBeLessThanOrEqual(data.fulfilledOrders);
    }
  });

  test("uses provided category when given", () => {
    const data = generateSupplierData("SUP-001", "custom_category");
    expect(data.categories).toContain("custom_category");
  });

  test("uses provided region when given", () => {
    const data = generateSupplierData("SUP-001", undefined, "custom_region");
    expect(data.regions).toContain("custom_region");
  });
});
