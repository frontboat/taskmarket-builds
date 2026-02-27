import { describe, test, expect } from "bun:test";
import { createSupplierAPI, type DataSource } from "../api";
import {
  scoreOutputSchema,
  leadTimeOutputSchema,
  disruptionOutputSchema,
  errorSchema,
} from "../schemas";
import { generateSupplierData, type SupplierData } from "../supplier-scoring";

// --- Mock DataSource ---

function createTestDataSource(): DataSource {
  return {
    async getSupplierData(supplierId: string, category?: string, region?: string): Promise<SupplierData | null> {
      if (supplierId === "NONEXISTENT") return null;
      return generateSupplierData(supplierId, category, region);
    },
    async getAllSupplierAlerts(region?: string): Promise<SupplierData[]> {
      const ids = ["SUP-001", "SUP-002", "SUP-003", "SUP-004", "SUP-005"];
      const suppliers = ids.map((id) => generateSupplierData(id, undefined, region));
      return suppliers.filter((s) => s.activeAlerts.length > 0);
    },
  };
}

function createApp() {
  return createSupplierAPI(createTestDataSource());
}

function req(path: string) {
  return new Request(`http://localhost${path}`);
}

// --- /v1/suppliers/score ---

describe("GET /v1/suppliers/score", () => {
  const app = createApp();

  test("returns 200 with valid supplierId", async () => {
    const res = await app.fetch(req("/v1/suppliers/score?supplierId=SUP-001"));
    expect(res.status).toBe(200);
  });

  test("response validates against output schema", async () => {
    const res = await app.fetch(req("/v1/suppliers/score?supplierId=SUP-001"));
    const body = await res.json();
    const result = scoreOutputSchema.safeParse(body);
    expect(result.success).toBe(true);
  });

  test("returns correct supplierId in response", async () => {
    const res = await app.fetch(req("/v1/suppliers/score?supplierId=SUP-042"));
    const body = await res.json();
    expect(body.supplierId).toBe("SUP-042");
  });

  test("returns 400 for missing supplierId", async () => {
    const res = await app.fetch(req("/v1/suppliers/score"));
    expect(res.status).toBe(400);
    const body = await res.json();
    const errResult = errorSchema.safeParse(body);
    expect(errResult.success).toBe(true);
  });

  test("returns 404 for nonexistent supplier", async () => {
    const res = await app.fetch(req("/v1/suppliers/score?supplierId=NONEXISTENT"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("SUPPLIER_NOT_FOUND");
  });

  test("accepts optional category parameter", async () => {
    const res = await app.fetch(req("/v1/suppliers/score?supplierId=SUP-001&category=electronics"));
    expect(res.status).toBe(200);
  });

  test("accepts optional region parameter", async () => {
    const res = await app.fetch(req("/v1/suppliers/score?supplierId=SUP-001&region=europe"));
    expect(res.status).toBe(200);
  });

  test("score is between 0 and 100", async () => {
    const res = await app.fetch(req("/v1/suppliers/score?supplierId=SUP-001"));
    const body = await res.json();
    expect(body.supplier_score).toBeGreaterThanOrEqual(0);
    expect(body.supplier_score).toBeLessThanOrEqual(100);
  });

  test("fill_rate is between 0 and 1", async () => {
    const res = await app.fetch(req("/v1/suppliers/score?supplierId=SUP-001"));
    const body = await res.json();
    expect(body.fill_rate).toBeGreaterThanOrEqual(0);
    expect(body.fill_rate).toBeLessThanOrEqual(1);
  });

  test("reliability_grade is valid", async () => {
    const res = await app.fetch(req("/v1/suppliers/score?supplierId=SUP-001"));
    const body = await res.json();
    expect(["A", "B", "C", "D", "F"]).toContain(body.reliability_grade);
  });

  test("includes freshness metadata", async () => {
    const res = await app.fetch(req("/v1/suppliers/score?supplierId=SUP-001"));
    const body = await res.json();
    expect(body.freshness).toBeDefined();
    expect(body.freshness.timestamp).toBeDefined();
    expect(typeof body.freshness.ageSeconds).toBe("number");
    expect(typeof body.freshness.stale).toBe("boolean");
  });

  test("deterministic - same input same output", async () => {
    const res1 = await app.fetch(req("/v1/suppliers/score?supplierId=SUP-001"));
    const body1 = await res1.json();
    const res2 = await app.fetch(req("/v1/suppliers/score?supplierId=SUP-001"));
    const body2 = await res2.json();
    expect(body1.supplier_score).toBe(body2.supplier_score);
    expect(body1.fill_rate).toBe(body2.fill_rate);
    expect(body1.on_time_rate).toBe(body2.on_time_rate);
    expect(body1.defect_rate).toBe(body2.defect_rate);
  });
});

// --- /v1/suppliers/lead-time-forecast ---

describe("GET /v1/suppliers/lead-time-forecast", () => {
  const app = createApp();

  test("returns 200 with valid supplierId", async () => {
    const res = await app.fetch(req("/v1/suppliers/lead-time-forecast?supplierId=SUP-001"));
    expect(res.status).toBe(200);
  });

  test("response validates against output schema", async () => {
    const res = await app.fetch(req("/v1/suppliers/lead-time-forecast?supplierId=SUP-001"));
    const body = await res.json();
    const result = leadTimeOutputSchema.safeParse(body);
    expect(result.success).toBe(true);
  });

  test("returns correct supplierId", async () => {
    const res = await app.fetch(req("/v1/suppliers/lead-time-forecast?supplierId=SUP-099"));
    const body = await res.json();
    expect(body.supplierId).toBe("SUP-099");
  });

  test("defaults horizonDays to 30", async () => {
    const res = await app.fetch(req("/v1/suppliers/lead-time-forecast?supplierId=SUP-001"));
    const body = await res.json();
    expect(body.forecast_window_days).toBe(30);
  });

  test("accepts custom horizonDays", async () => {
    const res = await app.fetch(req("/v1/suppliers/lead-time-forecast?supplierId=SUP-001&horizonDays=90"));
    const body = await res.json();
    expect(body.forecast_window_days).toBe(90);
  });

  test("returns 400 for missing supplierId", async () => {
    const res = await app.fetch(req("/v1/suppliers/lead-time-forecast"));
    expect(res.status).toBe(400);
  });

  test("returns 400 for horizonDays out of range", async () => {
    const res = await app.fetch(req("/v1/suppliers/lead-time-forecast?supplierId=SUP-001&horizonDays=500"));
    expect(res.status).toBe(400);
  });

  test("returns 404 for nonexistent supplier", async () => {
    const res = await app.fetch(req("/v1/suppliers/lead-time-forecast?supplierId=NONEXISTENT"));
    expect(res.status).toBe(404);
  });

  test("p95 >= p50", async () => {
    const res = await app.fetch(req("/v1/suppliers/lead-time-forecast?supplierId=SUP-001"));
    const body = await res.json();
    expect(body.lead_time_p95).toBeGreaterThanOrEqual(body.lead_time_p50);
  });

  test("drift_direction is valid", async () => {
    const res = await app.fetch(req("/v1/suppliers/lead-time-forecast?supplierId=SUP-001"));
    const body = await res.json();
    expect(["improving", "stable", "degrading"]).toContain(body.drift_direction);
  });

  test("includes freshness metadata", async () => {
    const res = await app.fetch(req("/v1/suppliers/lead-time-forecast?supplierId=SUP-001"));
    const body = await res.json();
    expect(body.freshness).toBeDefined();
  });
});

// --- /v1/suppliers/disruption-alerts ---

describe("GET /v1/suppliers/disruption-alerts", () => {
  const app = createApp();

  test("returns 200 with no parameters (all alerts)", async () => {
    const res = await app.fetch(req("/v1/suppliers/disruption-alerts"));
    expect(res.status).toBe(200);
  });

  test("response validates against output schema", async () => {
    const res = await app.fetch(req("/v1/suppliers/disruption-alerts?supplierId=SUP-001"));
    const body = await res.json();
    const result = disruptionOutputSchema.safeParse(body);
    expect(result.success).toBe(true);
  });

  test("returns alerts for specific supplier", async () => {
    const res = await app.fetch(req("/v1/suppliers/disruption-alerts?supplierId=SUP-001"));
    const body = await res.json();
    expect(body.alerts).toBeDefined();
    expect(Array.isArray(body.alerts)).toBe(true);
  });

  test("total_alerts matches alerts array length", async () => {
    const res = await app.fetch(req("/v1/suppliers/disruption-alerts?supplierId=SUP-001"));
    const body = await res.json();
    expect(body.total_alerts).toBe(body.alerts.length);
  });

  test("returns 404 for nonexistent specific supplier", async () => {
    const res = await app.fetch(req("/v1/suppliers/disruption-alerts?supplierId=NONEXISTENT"));
    expect(res.status).toBe(404);
  });

  test("accepts riskTolerance parameter", async () => {
    const res = await app.fetch(req("/v1/suppliers/disruption-alerts?riskTolerance=low"));
    expect(res.status).toBe(200);
  });

  test("rejects invalid riskTolerance", async () => {
    const res = await app.fetch(req("/v1/suppliers/disruption-alerts?riskTolerance=extreme"));
    expect(res.status).toBe(400);
  });

  test("defaults riskTolerance to medium", async () => {
    const res = await app.fetch(req("/v1/suppliers/disruption-alerts"));
    expect(res.status).toBe(200);
  });

  test("includes freshness metadata", async () => {
    const res = await app.fetch(req("/v1/suppliers/disruption-alerts"));
    const body = await res.json();
    expect(body.freshness).toBeDefined();
    expect(body.freshness.timestamp).toBeDefined();
  });

  test("accepts region filter", async () => {
    const res = await app.fetch(req("/v1/suppliers/disruption-alerts?region=europe"));
    expect(res.status).toBe(200);
  });
});
