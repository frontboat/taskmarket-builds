import { z } from "zod";

// --- Shared ---

export const freshnessSchema = z.object({
  timestamp: z.string().datetime(),
  ageSeconds: z.number().nonnegative(),
  stale: z.boolean(),
});

// --- GET /v1/provenance/lineage ---

export const lineageInputSchema = z.object({
  datasetId: z.string().min(1, "datasetId is required"),
  maxDepth: z.coerce.number().int().min(1).max(10).default(3),
});

export const lineageNodeSchema = z.object({
  sourceId: z.string(),
  type: z.string(),
  updatedAt: z.string().datetime(),
  dataPoints: z.number().nonnegative().int(),
});

export const lineageEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  transformType: z.string(),
});

export const lineageOutputSchema = z.object({
  datasetId: z.string(),
  nodes: z.array(lineageNodeSchema),
  edges: z.array(lineageEdgeSchema),
  freshness: freshnessSchema,
});

// --- GET /v1/provenance/freshness ---

export const freshnessInputSchema = z.object({
  datasetId: z.string().min(1, "datasetId is required"),
  maxStalenessMs: z.coerce.number().nonnegative().default(300000),
});

export const freshnessOutputSchema = z.object({
  datasetId: z.string(),
  staleness_ms: z.number().nonnegative(),
  sla_status: z.enum(["fresh", "stale", "unknown"]),
  lastUpdated: z.string().datetime(),
  confidence: z.number().min(0).max(1),
  freshness: freshnessSchema,
});

// --- POST /v1/provenance/verify-hash ---

export const verifyHashInputSchema = z.object({
  datasetId: z.string().min(1, "datasetId is required"),
  expectedHash: z.string().regex(/^[a-fA-F0-9]+$/, "expectedHash must be a hex string"),
  algorithm: z.enum(["sha256", "sha384", "sha512"]).default("sha256"),
});

export const verifyHashOutputSchema = z.object({
  datasetId: z.string(),
  verified: z.boolean(),
  computedHash: z.string(),
  algorithm: z.enum(["sha256", "sha384", "sha512"]),
  matchDetails: z.object({
    expectedHash: z.string(),
    match: z.boolean(),
    bytesVerified: z.number().nonnegative().int(),
  }),
  attestation_ref: z.string(),
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
export type LineageInput = z.infer<typeof lineageInputSchema>;
export type LineageOutput = z.infer<typeof lineageOutputSchema>;
export type LineageNode = z.infer<typeof lineageNodeSchema>;
export type LineageEdge = z.infer<typeof lineageEdgeSchema>;
export type FreshnessInput = z.infer<typeof freshnessInputSchema>;
export type FreshnessOutput = z.infer<typeof freshnessOutputSchema>;
export type VerifyHashInput = z.infer<typeof verifyHashInputSchema>;
export type VerifyHashOutput = z.infer<typeof verifyHashOutputSchema>;
