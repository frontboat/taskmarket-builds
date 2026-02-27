import { z } from "zod";

// --- Shared ---

export const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address");

export const networkSchema = z.enum(["ethereum", "base", "polygon"]).default("base");

export const freshnessSchema = z.object({
  timestamp: z.string().datetime(),
  ageSeconds: z.number().nonnegative(),
  stale: z.boolean(),
});

// --- POST /v1/risk/score ---

export const riskScoreInputSchema = z.object({
  address: addressSchema,
  network: networkSchema,
  transaction_context: z.string().optional(),
  lookback_days: z.coerce.number().int().min(1).max(365).default(30),
});

export const riskFactorSchema = z.object({
  factor: z.string(),
  score: z.number().min(0).max(100),
  weight: z.number().min(0).max(1),
  description: z.string(),
});

export const riskLevelSchema = z.enum(["low", "medium", "high", "critical"]);

export const riskScoreOutputSchema = z.object({
  address: z.string(),
  risk_score: z.number().min(0).max(100),
  risk_level: riskLevelSchema,
  risk_factors: z.array(riskFactorSchema),
  sanctions_proximity: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  freshness: freshnessSchema,
});

// --- GET /v1/risk/exposure-paths ---

export const exposurePathsInputSchema = z.object({
  address: addressSchema,
  network: networkSchema,
  threshold: z.coerce.number().min(0).max(100).default(50),
  maxHops: z.coerce.number().int().min(1).max(6).default(3),
});

export const pathEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  relationship: z.string(),
  risk_contribution: z.number().min(0).max(100),
  hop: z.number().int().min(1),
});

export const exposurePathsOutputSchema = z.object({
  address: z.string(),
  paths: z.array(pathEdgeSchema),
  total_exposure: z.number().min(0).max(100),
  highest_risk_path_score: z.number().min(0).max(100),
  freshness: freshnessSchema,
});

// --- GET /v1/risk/entity-profile ---

export const entityProfileInputSchema = z.object({
  address: addressSchema,
  network: networkSchema,
});

export const entityTypeSchema = z.enum([
  "individual",
  "exchange",
  "defi_protocol",
  "bridge",
  "mixer",
  "unknown",
]);

export const entityProfileOutputSchema = z.object({
  address: z.string(),
  cluster_id: z.string(),
  entity_type: entityTypeSchema,
  related_addresses: z.array(z.string()),
  transaction_volume_30d: z.string(),
  first_seen: z.string().datetime(),
  last_active: z.string().datetime(),
  tags: z.array(z.string()),
  confidence: z.number().min(0).max(1),
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
export type RiskScoreInput = z.infer<typeof riskScoreInputSchema>;
export type RiskScoreOutput = z.infer<typeof riskScoreOutputSchema>;
export type RiskFactor = z.infer<typeof riskFactorSchema>;
export type RiskLevel = z.infer<typeof riskLevelSchema>;
export type ExposurePathsInput = z.infer<typeof exposurePathsInputSchema>;
export type ExposurePathsOutput = z.infer<typeof exposurePathsOutputSchema>;
export type PathEdge = z.infer<typeof pathEdgeSchema>;
export type EntityProfileInput = z.infer<typeof entityProfileInputSchema>;
export type EntityProfileOutput = z.infer<typeof entityProfileOutputSchema>;
export type EntityType = z.infer<typeof entityTypeSchema>;
export type Freshness = z.infer<typeof freshnessSchema>;
