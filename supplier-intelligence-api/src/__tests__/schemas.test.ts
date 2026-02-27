import { describe, test, expect } from "bun:test";
import {
  freshnessSchema,
  severitySchema,
  scoreInputSchema,
  scoreOutputSchema,
  riskFactorSchema,
  leadTimeInputSchema,
  leadTimeOutputSchema,
  driftDirectionSchema,
  disruptionInputSchema,
  disruptionOutputSchema,
  disruptionAlertSchema,
  alertTypeSchema,
  alertSeveritySchema,
  riskToleranceSchema,
  errorSchema,
} from "../schemas";

// --- Freshness schema ---

describe("freshnessSchema", () => {
  test("accepts valid freshness", () => {
    const result = freshnessSchema.safeParse({
      timestamp: "2024-01-15T10:30:00.000Z",
      ageSeconds: 5,
      stale: false,
    });
    expect(result.success).toBe(true);
  });

  test("accepts stale freshness", () => {
    const result = freshnessSchema.safeParse({
      timestamp: "2024-01-15T10:30:00.000Z",
      ageSeconds: 600,
      stale: true,
    });
    expect(result.success).toBe(true);
  });

  test("rejects negative ageSeconds", () => {
    const result = freshnessSchema.safeParse({
      timestamp: "2024-01-15T10:30:00.000Z",
      ageSeconds: -1,
      stale: false,
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid timestamp", () => {
    const result = freshnessSchema.safeParse({
      timestamp: "not-a-date",
      ageSeconds: 0,
      stale: false,
    });
    expect(result.success).toBe(false);
  });

  test("rejects missing fields", () => {
    const result = freshnessSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// --- Severity schema ---

describe("severitySchema", () => {
  test("accepts 'low'", () => {
    expect(severitySchema.safeParse("low").success).toBe(true);
  });

  test("accepts 'medium'", () => {
    expect(severitySchema.safeParse("medium").success).toBe(true);
  });

  test("accepts 'high'", () => {
    expect(severitySchema.safeParse("high").success).toBe(true);
  });

  test("rejects 'critical' (not in severity enum)", () => {
    expect(severitySchema.safeParse("critical").success).toBe(false);
  });

  test("rejects empty string", () => {
    expect(severitySchema.safeParse("").success).toBe(false);
  });
});

// --- Score input schema ---

describe("scoreInputSchema", () => {
  test("accepts valid input with supplierId only", () => {
    const result = scoreInputSchema.safeParse({ supplierId: "SUP-001" });
    expect(result.success).toBe(true);
  });

  test("accepts input with all optional fields", () => {
    const result = scoreInputSchema.safeParse({
      supplierId: "SUP-001",
      category: "electronics",
      region: "north_america",
    });
    expect(result.success).toBe(true);
  });

  test("rejects missing supplierId", () => {
    const result = scoreInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  test("rejects empty supplierId", () => {
    const result = scoreInputSchema.safeParse({ supplierId: "" });
    expect(result.success).toBe(false);
  });

  test("category is optional", () => {
    const result = scoreInputSchema.safeParse({ supplierId: "SUP-001" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBeUndefined();
    }
  });

  test("region is optional", () => {
    const result = scoreInputSchema.safeParse({ supplierId: "SUP-001" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.region).toBeUndefined();
    }
  });
});

// --- Risk factor schema ---

describe("riskFactorSchema", () => {
  test("accepts valid risk factor", () => {
    const result = riskFactorSchema.safeParse({
      factor: "low_fill_rate",
      severity: "high",
      description: "Fill rate below threshold",
    });
    expect(result.success).toBe(true);
  });

  test("rejects invalid severity", () => {
    const result = riskFactorSchema.safeParse({
      factor: "test",
      severity: "extreme",
      description: "test",
    });
    expect(result.success).toBe(false);
  });

  test("rejects missing factor", () => {
    const result = riskFactorSchema.safeParse({
      severity: "low",
      description: "test",
    });
    expect(result.success).toBe(false);
  });
});

// --- Score output schema ---

describe("scoreOutputSchema", () => {
  const validOutput = {
    supplierId: "SUP-001",
    supplier_score: 85.5,
    reliability_grade: "B" as const,
    fill_rate: 0.95,
    on_time_rate: 0.88,
    defect_rate: 0.02,
    risk_factors: [],
    confidence: 0.8,
    freshness: {
      timestamp: "2024-01-15T10:30:00.000Z",
      ageSeconds: 0,
      stale: false,
    },
  };

  test("accepts valid score output", () => {
    const result = scoreOutputSchema.safeParse(validOutput);
    expect(result.success).toBe(true);
  });

  test("rejects supplier_score above 100", () => {
    const result = scoreOutputSchema.safeParse({ ...validOutput, supplier_score: 101 });
    expect(result.success).toBe(false);
  });

  test("rejects supplier_score below 0", () => {
    const result = scoreOutputSchema.safeParse({ ...validOutput, supplier_score: -1 });
    expect(result.success).toBe(false);
  });

  test("rejects fill_rate above 1", () => {
    const result = scoreOutputSchema.safeParse({ ...validOutput, fill_rate: 1.5 });
    expect(result.success).toBe(false);
  });

  test("rejects on_time_rate below 0", () => {
    const result = scoreOutputSchema.safeParse({ ...validOutput, on_time_rate: -0.1 });
    expect(result.success).toBe(false);
  });

  test("rejects defect_rate above 1", () => {
    const result = scoreOutputSchema.safeParse({ ...validOutput, defect_rate: 1.2 });
    expect(result.success).toBe(false);
  });

  test("rejects invalid reliability_grade", () => {
    const result = scoreOutputSchema.safeParse({ ...validOutput, reliability_grade: "E" });
    expect(result.success).toBe(false);
  });

  test("accepts all valid grades", () => {
    for (const grade of ["A", "B", "C", "D", "F"]) {
      const result = scoreOutputSchema.safeParse({ ...validOutput, reliability_grade: grade });
      expect(result.success).toBe(true);
    }
  });

  test("rejects confidence above 1", () => {
    const result = scoreOutputSchema.safeParse({ ...validOutput, confidence: 1.5 });
    expect(result.success).toBe(false);
  });
});

// --- Lead time input schema ---

describe("leadTimeInputSchema", () => {
  test("accepts valid input with supplierId only", () => {
    const result = leadTimeInputSchema.safeParse({ supplierId: "SUP-001" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.horizonDays).toBe(30);
    }
  });

  test("accepts custom horizonDays", () => {
    const result = leadTimeInputSchema.safeParse({ supplierId: "SUP-001", horizonDays: "90" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.horizonDays).toBe(90);
    }
  });

  test("rejects horizonDays above 365", () => {
    const result = leadTimeInputSchema.safeParse({ supplierId: "SUP-001", horizonDays: "400" });
    expect(result.success).toBe(false);
  });

  test("rejects horizonDays below 1", () => {
    const result = leadTimeInputSchema.safeParse({ supplierId: "SUP-001", horizonDays: "0" });
    expect(result.success).toBe(false);
  });

  test("rejects missing supplierId", () => {
    const result = leadTimeInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  test("coerces string horizonDays to number", () => {
    const result = leadTimeInputSchema.safeParse({ supplierId: "SUP-001", horizonDays: "60" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.horizonDays).toBe("number");
    }
  });
});

// --- Lead time output schema ---

describe("leadTimeOutputSchema", () => {
  const validOutput = {
    supplierId: "SUP-001",
    lead_time_p50: 7.5,
    lead_time_p95: 14.2,
    drift_direction: "stable" as const,
    drift_magnitude: 0.15,
    forecast_window_days: 30,
    historical_variance: 4.5,
    confidence: 0.75,
    freshness: {
      timestamp: "2024-01-15T10:30:00.000Z",
      ageSeconds: 0,
      stale: false,
    },
  };

  test("accepts valid lead time output", () => {
    const result = leadTimeOutputSchema.safeParse(validOutput);
    expect(result.success).toBe(true);
  });

  test("rejects negative lead_time_p50", () => {
    const result = leadTimeOutputSchema.safeParse({ ...validOutput, lead_time_p50: -1 });
    expect(result.success).toBe(false);
  });

  test("rejects drift_magnitude above 1", () => {
    const result = leadTimeOutputSchema.safeParse({ ...validOutput, drift_magnitude: 1.5 });
    expect(result.success).toBe(false);
  });

  test("accepts all drift directions", () => {
    for (const dir of ["improving", "stable", "degrading"]) {
      const result = leadTimeOutputSchema.safeParse({ ...validOutput, drift_direction: dir });
      expect(result.success).toBe(true);
    }
  });
});

// --- Drift direction schema ---

describe("driftDirectionSchema", () => {
  test("accepts 'improving'", () => {
    expect(driftDirectionSchema.safeParse("improving").success).toBe(true);
  });

  test("accepts 'stable'", () => {
    expect(driftDirectionSchema.safeParse("stable").success).toBe(true);
  });

  test("accepts 'degrading'", () => {
    expect(driftDirectionSchema.safeParse("degrading").success).toBe(true);
  });

  test("rejects invalid direction", () => {
    expect(driftDirectionSchema.safeParse("unknown").success).toBe(false);
  });
});

// --- Disruption input schema ---

describe("disruptionInputSchema", () => {
  test("accepts empty input (all optional)", () => {
    const result = disruptionInputSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.riskTolerance).toBe("medium");
    }
  });

  test("accepts supplierId", () => {
    const result = disruptionInputSchema.safeParse({ supplierId: "SUP-001" });
    expect(result.success).toBe(true);
  });

  test("accepts region filter", () => {
    const result = disruptionInputSchema.safeParse({ region: "europe" });
    expect(result.success).toBe(true);
  });

  test("accepts valid riskTolerance values", () => {
    for (const tol of ["low", "medium", "high"]) {
      const result = disruptionInputSchema.safeParse({ riskTolerance: tol });
      expect(result.success).toBe(true);
    }
  });

  test("rejects invalid riskTolerance", () => {
    const result = disruptionInputSchema.safeParse({ riskTolerance: "extreme" });
    expect(result.success).toBe(false);
  });
});

// --- Disruption alert schema ---

describe("disruptionAlertSchema", () => {
  const validAlert = {
    supplierId: "SUP-001",
    alert_type: "weather" as const,
    severity: "high" as const,
    disruption_probability: 0.75,
    affected_categories: ["electronics"],
    affected_regions: ["asia_pacific"],
    detected_at: "2024-01-15T10:30:00.000Z",
    description: "Typhoon approaching manufacturing region",
  };

  test("accepts valid alert", () => {
    const result = disruptionAlertSchema.safeParse(validAlert);
    expect(result.success).toBe(true);
  });

  test("accepts all alert types", () => {
    for (const type of ["weather", "geopolitical", "financial", "logistics", "quality"]) {
      const result = disruptionAlertSchema.safeParse({ ...validAlert, alert_type: type });
      expect(result.success).toBe(true);
    }
  });

  test("accepts all alert severities", () => {
    for (const sev of ["low", "medium", "high", "critical"]) {
      const result = disruptionAlertSchema.safeParse({ ...validAlert, severity: sev });
      expect(result.success).toBe(true);
    }
  });

  test("rejects disruption_probability above 1", () => {
    const result = disruptionAlertSchema.safeParse({ ...validAlert, disruption_probability: 1.5 });
    expect(result.success).toBe(false);
  });

  test("rejects disruption_probability below 0", () => {
    const result = disruptionAlertSchema.safeParse({ ...validAlert, disruption_probability: -0.1 });
    expect(result.success).toBe(false);
  });
});

// --- Alert type / severity / risk tolerance ---

describe("alertTypeSchema", () => {
  test("accepts all valid types", () => {
    for (const t of ["weather", "geopolitical", "financial", "logistics", "quality"]) {
      expect(alertTypeSchema.safeParse(t).success).toBe(true);
    }
  });

  test("rejects invalid type", () => {
    expect(alertTypeSchema.safeParse("pandemic").success).toBe(false);
  });
});

describe("alertSeveritySchema", () => {
  test("accepts all valid severities", () => {
    for (const s of ["low", "medium", "high", "critical"]) {
      expect(alertSeveritySchema.safeParse(s).success).toBe(true);
    }
  });

  test("rejects invalid severity", () => {
    expect(alertSeveritySchema.safeParse("extreme").success).toBe(false);
  });
});

describe("riskToleranceSchema", () => {
  test("accepts all valid tolerances", () => {
    for (const r of ["low", "medium", "high"]) {
      expect(riskToleranceSchema.safeParse(r).success).toBe(true);
    }
  });

  test("rejects invalid tolerance", () => {
    expect(riskToleranceSchema.safeParse("none").success).toBe(false);
  });
});

// --- Disruption output schema ---

describe("disruptionOutputSchema", () => {
  test("accepts valid output with alerts", () => {
    const result = disruptionOutputSchema.safeParse({
      alerts: [
        {
          supplierId: "SUP-001",
          alert_type: "weather",
          severity: "high",
          disruption_probability: 0.75,
          affected_categories: ["electronics"],
          affected_regions: ["asia_pacific"],
          detected_at: "2024-01-15T10:30:00.000Z",
          description: "Test alert",
        },
      ],
      total_alerts: 1,
      freshness: {
        timestamp: "2024-01-15T10:30:00.000Z",
        ageSeconds: 0,
        stale: false,
      },
    });
    expect(result.success).toBe(true);
  });

  test("accepts empty alerts array", () => {
    const result = disruptionOutputSchema.safeParse({
      alerts: [],
      total_alerts: 0,
      freshness: {
        timestamp: "2024-01-15T10:30:00.000Z",
        ageSeconds: 0,
        stale: false,
      },
    });
    expect(result.success).toBe(true);
  });

  test("rejects negative total_alerts", () => {
    const result = disruptionOutputSchema.safeParse({
      alerts: [],
      total_alerts: -1,
      freshness: {
        timestamp: "2024-01-15T10:30:00.000Z",
        ageSeconds: 0,
        stale: false,
      },
    });
    expect(result.success).toBe(false);
  });
});

// --- Error schema ---

describe("errorSchema", () => {
  test("accepts valid error envelope", () => {
    const result = errorSchema.safeParse({
      error: { code: "VALIDATION_ERROR", message: "Invalid input" },
    });
    expect(result.success).toBe(true);
  });

  test("rejects missing code", () => {
    const result = errorSchema.safeParse({
      error: { message: "Invalid input" },
    });
    expect(result.success).toBe(false);
  });

  test("rejects missing message", () => {
    const result = errorSchema.safeParse({
      error: { code: "ERROR" },
    });
    expect(result.success).toBe(false);
  });

  test("rejects missing error wrapper", () => {
    const result = errorSchema.safeParse({ code: "ERROR", message: "test" });
    expect(result.success).toBe(false);
  });
});
