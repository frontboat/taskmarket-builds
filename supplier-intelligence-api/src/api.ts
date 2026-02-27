import { Hono } from "hono";
import {
  scoreInputSchema,
  scoreOutputSchema,
  leadTimeInputSchema,
  leadTimeOutputSchema,
  disruptionInputSchema,
  disruptionOutputSchema,
  type ScoreOutput,
  type LeadTimeOutput,
  type DisruptionOutput,
} from "./schemas";
import {
  computeSupplierScore,
  computeReliabilityGrade,
  computeFillRate,
  computeOnTimeRate,
  computeDefectRate,
  computeRiskFactors,
  computeConfidence,
  computeFreshness,
  computeLeadTimeForecast,
  buildDisruptionAlerts,
  filterAlertsByRiskTolerance,
  type SupplierData,
} from "./supplier-scoring";

export interface DataSource {
  getSupplierData(supplierId: string, category?: string, region?: string): Promise<SupplierData | null>;
  getAllSupplierAlerts(region?: string): Promise<SupplierData[]>;
}

export function createSupplierAPI(dataSource: DataSource) {
  const app = new Hono();

  app.get("/v1/suppliers/score", async (c) => {
    const raw = {
      supplierId: c.req.query("supplierId"),
      category: c.req.query("category"),
      region: c.req.query("region"),
    };

    const parsed = scoreInputSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, 400);
    }

    const { supplierId, category, region } = parsed.data;
    const fetchedAt = new Date();

    const data = await dataSource.getSupplierData(supplierId, category, region);
    if (!data) {
      return c.json({ error: { code: "SUPPLIER_NOT_FOUND", message: "Supplier not found" } }, 404);
    }

    const score = computeSupplierScore(data);
    const output: ScoreOutput = {
      supplierId,
      supplier_score: score,
      reliability_grade: computeReliabilityGrade(score),
      fill_rate: computeFillRate(data),
      on_time_rate: computeOnTimeRate(data),
      defect_rate: computeDefectRate(data),
      risk_factors: computeRiskFactors(data),
      confidence: computeConfidence(data),
      freshness: computeFreshness(fetchedAt),
    };

    scoreOutputSchema.parse(output);
    return c.json(output);
  });

  app.get("/v1/suppliers/lead-time-forecast", async (c) => {
    const raw = {
      supplierId: c.req.query("supplierId"),
      category: c.req.query("category"),
      horizonDays: c.req.query("horizonDays"),
    };

    const parsed = leadTimeInputSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, 400);
    }

    const { supplierId, category, horizonDays } = parsed.data;
    const fetchedAt = new Date();

    const data = await dataSource.getSupplierData(supplierId, category);
    if (!data) {
      return c.json({ error: { code: "SUPPLIER_NOT_FOUND", message: "Supplier not found" } }, 404);
    }

    const forecast = computeLeadTimeForecast(data, horizonDays);
    const output: LeadTimeOutput = {
      supplierId,
      lead_time_p50: forecast.lead_time_p50,
      lead_time_p95: forecast.lead_time_p95,
      drift_direction: forecast.drift_direction,
      drift_magnitude: forecast.drift_magnitude,
      forecast_window_days: horizonDays,
      historical_variance: forecast.historical_variance,
      confidence: computeConfidence(data),
      freshness: computeFreshness(fetchedAt),
    };

    leadTimeOutputSchema.parse(output);
    return c.json(output);
  });

  app.get("/v1/suppliers/disruption-alerts", async (c) => {
    const raw = {
      supplierId: c.req.query("supplierId") || undefined,
      region: c.req.query("region") || undefined,
      riskTolerance: c.req.query("riskTolerance"),
    };

    const parsed = disruptionInputSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, 400);
    }

    const { supplierId, region, riskTolerance } = parsed.data;
    const fetchedAt = new Date();

    let allAlerts: ReturnType<typeof buildDisruptionAlerts> = [];

    if (supplierId) {
      const data = await dataSource.getSupplierData(supplierId, undefined, region);
      if (!data) {
        return c.json({ error: { code: "SUPPLIER_NOT_FOUND", message: "Supplier not found" } }, 404);
      }
      allAlerts = buildDisruptionAlerts(data);
    } else {
      const suppliers = await dataSource.getAllSupplierAlerts(region);
      for (const supplier of suppliers) {
        allAlerts.push(...buildDisruptionAlerts(supplier));
      }
    }

    const filtered = filterAlertsByRiskTolerance(allAlerts, riskTolerance);

    const output: DisruptionOutput = {
      alerts: filtered,
      total_alerts: filtered.length,
      freshness: computeFreshness(fetchedAt),
    };

    disruptionOutputSchema.parse(output);
    return c.json(output);
  });

  return app;
}
