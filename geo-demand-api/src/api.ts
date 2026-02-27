import { Hono } from "hono";
import {
  demandIndexInputSchema,
  demandIndexOutputSchema,
  trendInputSchema,
  trendOutputSchema,
  anomalyInputSchema,
  anomalyOutputSchema,
  type DemandIndexOutput,
  type TrendOutput,
  type AnomalyOutput,
} from "./schemas";
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
} from "./demand";

export interface DataSource {
  getDemandData(geoCode: string, category: string): Promise<{ geoCode: string; category: string; exists: boolean } | null>;
  getGeoExists(geoCode: string): Promise<boolean>;
}

export function createDemandAPI(dataSource: DataSource) {
  const app = new Hono();

  app.get("/v1/demand/index", async (c) => {
    const raw = {
      geoType: c.req.query("geoType"),
      geoCode: c.req.query("geoCode"),
      category: c.req.query("category"),
      seasonalityMode: c.req.query("seasonalityMode"),
    };

    const parsed = demandIndexInputSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, 400);
    }

    const { geoType, geoCode, category, seasonalityMode } = parsed.data;
    const fetchedAt = new Date();

    const geoExists = await dataSource.getGeoExists(geoCode);
    if (!geoExists) {
      return c.json({ error: { code: "GEO_NOT_FOUND", message: "Geo not found" } }, 404);
    }

    const demandIndex = computeDemandIndex(geoCode, category, seasonalityMode);
    const velocity = computeVelocity(geoCode, category);
    const confidence = computeConfidence(geoCode, category);
    const confidenceInterval = computeConfidenceInterval(demandIndex, confidence);
    const comparableGeos = computeComparableGeos(geoCode, geoType, category);

    const output: DemandIndexOutput = {
      geoType,
      geoCode,
      category,
      demand_index: demandIndex,
      velocity,
      confidence_interval: confidenceInterval,
      comparable_geos: comparableGeos,
      confidence,
      freshness: computeFreshness(fetchedAt),
    };

    demandIndexOutputSchema.parse(output);
    return c.json(output);
  });

  app.get("/v1/demand/trend", async (c) => {
    const raw = {
      geoType: c.req.query("geoType"),
      geoCode: c.req.query("geoCode"),
      category: c.req.query("category"),
      lookbackWindow: c.req.query("lookbackWindow"),
    };

    const parsed = trendInputSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, 400);
    }

    const { geoType, geoCode, category, lookbackWindow } = parsed.data;
    const fetchedAt = new Date();

    const geoExists = await dataSource.getGeoExists(geoCode);
    if (!geoExists) {
      return c.json({ error: { code: "GEO_NOT_FOUND", message: "Geo not found" } }, 404);
    }

    const dataPoints = computeTrendDataPoints(geoCode, category, lookbackWindow);
    const trendDirection = computeTrendDirection(geoCode, category, lookbackWindow);
    const trendStrength = computeTrendStrength(geoCode, category, lookbackWindow);

    const output: TrendOutput = {
      geoType,
      geoCode,
      category,
      lookbackWindow,
      data_points: dataPoints,
      trend_direction: trendDirection,
      trend_strength: trendStrength,
      freshness: computeFreshness(fetchedAt),
    };

    trendOutputSchema.parse(output);
    return c.json(output);
  });

  app.get("/v1/demand/anomalies", async (c) => {
    const raw: Record<string, unknown> = {
      geoType: c.req.query("geoType"),
      geoCode: c.req.query("geoCode"),
      threshold: c.req.query("threshold"),
    };

    // Only include category if provided
    const categoryParam = c.req.query("category");
    if (categoryParam !== undefined) {
      raw.category = categoryParam;
    }

    const parsed = anomalyInputSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, 400);
    }

    const { geoType, geoCode, category, threshold } = parsed.data;
    const fetchedAt = new Date();

    const geoExists = await dataSource.getGeoExists(geoCode);
    if (!geoExists) {
      return c.json({ error: { code: "GEO_NOT_FOUND", message: "Geo not found" } }, 404);
    }

    const anomalies = computeAnomalies(geoCode, geoType, category, threshold);

    const output: AnomalyOutput = {
      geoType,
      geoCode,
      anomalies,
      total_anomalies: anomalies.length,
      freshness: computeFreshness(fetchedAt),
    };

    anomalyOutputSchema.parse(output);
    return c.json(output);
  });

  return app;
}
