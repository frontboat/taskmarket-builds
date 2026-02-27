import { z } from "zod";

// --- Shared ---

export const freshnessSchema = z.object({
  timestamp: z.string().datetime(),
  ageSeconds: z.number().nonnegative(),
  stale: z.boolean(),
});

// --- GET /v1/demand/index ---

export const demandIndexInputSchema = z.object({
  geoType: z.enum(["zip", "city", "state", "country"]),
  geoCode: z.string().min(1),
  category: z.string().min(1),
  seasonalityMode: z.enum(["raw", "adjusted"]).default("adjusted"),
});

export const comparableGeoSchema = z.object({
  geoCode: z.string(),
  demand_index: z.number().min(0).max(200),
  similarity: z.number().min(0).max(1),
});

export const demandIndexOutputSchema = z.object({
  geoType: z.string(),
  geoCode: z.string(),
  category: z.string(),
  demand_index: z.number().min(0).max(200),
  velocity: z.number(),
  confidence_interval: z.object({
    lower: z.number().min(0).max(200),
    upper: z.number().min(0).max(200),
  }),
  comparable_geos: z.array(comparableGeoSchema),
  confidence: z.number().min(0).max(1),
  freshness: freshnessSchema,
});

// --- GET /v1/demand/trend ---

export const trendInputSchema = z.object({
  geoType: z.enum(["zip", "city", "state", "country"]),
  geoCode: z.string().min(1),
  category: z.string().min(1),
  lookbackWindow: z.enum(["7d", "30d", "90d", "365d"]).default("30d"),
});

export const dataPointSchema = z.object({
  date: z.string(),
  demand_index: z.number().min(0).max(200),
  velocity: z.number(),
});

export const trendOutputSchema = z.object({
  geoType: z.string(),
  geoCode: z.string(),
  category: z.string(),
  lookbackWindow: z.string(),
  data_points: z.array(dataPointSchema),
  trend_direction: z.enum(["accelerating", "stable", "decelerating", "volatile"]),
  trend_strength: z.number().min(0).max(1),
  freshness: freshnessSchema,
});

// --- GET /v1/demand/anomalies ---

export const anomalyInputSchema = z.object({
  geoType: z.enum(["zip", "city", "state", "country"]),
  geoCode: z.string().min(1),
  category: z.string().min(1).optional(),
  threshold: z.coerce.number().min(0).max(1).default(0.8),
});

export const anomalyEntrySchema = z.object({
  category: z.string(),
  anomaly_type: z.enum(["spike", "drop", "seasonal_deviation", "trend_break"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  confidence: z.number().min(0).max(1),
  detected_at: z.string(),
  description: z.string(),
});

export const anomalyOutputSchema = z.object({
  geoType: z.string(),
  geoCode: z.string(),
  anomalies: z.array(anomalyEntrySchema),
  total_anomalies: z.number().nonnegative().int(),
  freshness: freshnessSchema,
});

// --- Error envelope ---

export const errorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

// Types
export type DemandIndexInput = z.infer<typeof demandIndexInputSchema>;
export type DemandIndexOutput = z.infer<typeof demandIndexOutputSchema>;
export type TrendInput = z.infer<typeof trendInputSchema>;
export type TrendOutput = z.infer<typeof trendOutputSchema>;
export type AnomalyInput = z.infer<typeof anomalyInputSchema>;
export type AnomalyOutput = z.infer<typeof anomalyOutputSchema>;
export type AnomalyEntry = z.infer<typeof anomalyEntrySchema>;
export type ComparableGeo = z.infer<typeof comparableGeoSchema>;
export type DataPoint = z.infer<typeof dataPointSchema>;
export type Freshness = z.infer<typeof freshnessSchema>;
