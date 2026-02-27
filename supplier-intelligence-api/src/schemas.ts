import { z } from "zod";

// --- Shared ---

export const freshnessSchema = z.object({
  timestamp: z.string().datetime(),
  ageSeconds: z.number().nonnegative(),
  stale: z.boolean(),
});

export const severitySchema = z.enum(["low", "medium", "high"]);

// --- GET /v1/suppliers/score ---

export const scoreInputSchema = z.object({
  supplierId: z.string().min(1, "supplierId is required"),
  category: z.string().optional(),
  region: z.string().optional(),
});

export const riskFactorSchema = z.object({
  factor: z.string(),
  severity: severitySchema,
  description: z.string(),
});

export const scoreOutputSchema = z.object({
  supplierId: z.string(),
  supplier_score: z.number().min(0).max(100),
  reliability_grade: z.enum(["A", "B", "C", "D", "F"]),
  fill_rate: z.number().min(0).max(1),
  on_time_rate: z.number().min(0).max(1),
  defect_rate: z.number().min(0).max(1),
  risk_factors: z.array(riskFactorSchema),
  confidence: z.number().min(0).max(1),
  freshness: freshnessSchema,
});

// --- GET /v1/suppliers/lead-time-forecast ---

export const leadTimeInputSchema = z.object({
  supplierId: z.string().min(1, "supplierId is required"),
  category: z.string().optional(),
  horizonDays: z.coerce.number().int().min(1).max(365).default(30),
});

export const driftDirectionSchema = z.enum(["improving", "stable", "degrading"]);

export const leadTimeOutputSchema = z.object({
  supplierId: z.string(),
  lead_time_p50: z.number().nonnegative(),
  lead_time_p95: z.number().nonnegative(),
  drift_direction: driftDirectionSchema,
  drift_magnitude: z.number().min(0).max(1),
  forecast_window_days: z.number().int().min(1).max(365),
  historical_variance: z.number().nonnegative(),
  confidence: z.number().min(0).max(1),
  freshness: freshnessSchema,
});

// --- GET /v1/suppliers/disruption-alerts ---

export const alertTypeSchema = z.enum(["weather", "geopolitical", "financial", "logistics", "quality"]);
export const alertSeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export const riskToleranceSchema = z.enum(["low", "medium", "high"]);

export const disruptionInputSchema = z.object({
  supplierId: z.string().optional(),
  region: z.string().optional(),
  riskTolerance: riskToleranceSchema.default("medium"),
});

export const disruptionAlertSchema = z.object({
  supplierId: z.string(),
  alert_type: alertTypeSchema,
  severity: alertSeveritySchema,
  disruption_probability: z.number().min(0).max(1),
  affected_categories: z.array(z.string()),
  affected_regions: z.array(z.string()),
  detected_at: z.string().datetime(),
  description: z.string(),
});

export const disruptionOutputSchema = z.object({
  alerts: z.array(disruptionAlertSchema),
  total_alerts: z.number().nonnegative().int(),
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
export type Freshness = z.infer<typeof freshnessSchema>;
export type RiskFactor = z.infer<typeof riskFactorSchema>;
export type ScoreInput = z.infer<typeof scoreInputSchema>;
export type ScoreOutput = z.infer<typeof scoreOutputSchema>;
export type LeadTimeInput = z.infer<typeof leadTimeInputSchema>;
export type LeadTimeOutput = z.infer<typeof leadTimeOutputSchema>;
export type DisruptionInput = z.infer<typeof disruptionInputSchema>;
export type DisruptionOutput = z.infer<typeof disruptionOutputSchema>;
export type DisruptionAlert = z.infer<typeof disruptionAlertSchema>;
export type AlertType = z.infer<typeof alertTypeSchema>;
export type AlertSeverity = z.infer<typeof alertSeveritySchema>;
export type RiskTolerance = z.infer<typeof riskToleranceSchema>;
export type DriftDirection = z.infer<typeof driftDirectionSchema>;
