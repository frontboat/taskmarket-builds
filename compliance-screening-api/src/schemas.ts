import { z } from "zod";

// --- Shared ---

export const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address");

export const freshnessSchema = z.object({
  timestamp: z.string().datetime(),
  ageSeconds: z.number().nonnegative(),
  stale: z.boolean(),
});

// --- POST /v1/screening/check ---

export const identifierSchema = z.object({
  type: z.string().min(1),
  value: z.string().min(1),
});

export const screeningCheckInputSchema = z.object({
  entityName: z.string().min(1, "entityName is required"),
  entityType: z.enum(["individual", "organization"]).default("individual"),
  identifiers: z.array(identifierSchema).optional(),
  addresses: z.array(addressSchema).optional(),
  jurisdictions: z.array(z.string().min(1)).optional(),
});

export const matchSchema = z.object({
  listName: z.string(),
  matchedName: z.string(),
  matchScore: z.number().min(0).max(1),
  listCategory: z.enum(["sanctions", "pep", "adverse_media", "watchlist"]),
  listedSince: z.string().datetime(),
});

export const evidenceBundleItemSchema = z.object({
  source: z.string(),
  reference: z.string(),
  retrievedAt: z.string().datetime(),
});

export const screeningCheckOutputSchema = z.object({
  entityName: z.string(),
  screening_status: z.enum(["clear", "match", "potential_match", "inconclusive"]),
  match_confidence: z.number().min(0).max(1),
  matches: z.array(matchSchema),
  evidence_bundle: z.array(evidenceBundleItemSchema),
  confidence: z.number().min(0).max(1),
  freshness: freshnessSchema,
});

// --- GET /v1/screening/exposure-chain ---

export const exposureChainInputSchema = z.object({
  address: addressSchema,
  ownershipDepth: z.coerce.number().int().min(1).max(5).default(2),
});

export const chainEntitySchema = z.object({
  entity: z.string(),
  relationship: z.enum(["owner", "controller", "beneficiary", "associate"]),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  depth: z.number().int().min(1).max(5),
});

export const exposureChainOutputSchema = z.object({
  address: z.string(),
  chain: z.array(chainEntitySchema),
  aggregate_risk: z.enum(["low", "medium", "high", "critical"]),
  total_entities_scanned: z.number().nonnegative().int(),
  freshness: freshnessSchema,
});

// --- GET /v1/screening/jurisdiction-risk ---

export const jurisdictionRiskInputSchema = z.object({
  jurisdiction: z.string().regex(/^[A-Z]{2}$/, "Must be ISO-3166 country code (2 uppercase letters)"),
  industry: z.string().optional(),
});

export const riskFactorSchema = z.object({
  factor: z.string(),
  score: z.number().min(0).max(100),
  description: z.string(),
});

export const jurisdictionRiskOutputSchema = z.object({
  jurisdiction: z.string(),
  risk_score: z.number().min(0).max(100),
  risk_level: z.enum(["low", "medium", "high", "critical"]),
  risk_factors: z.array(riskFactorSchema),
  sanctions_programs: z.array(z.string()),
  last_updated: z.string().datetime(),
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
export type Identifier = z.infer<typeof identifierSchema>;
export type ScreeningCheckInput = z.infer<typeof screeningCheckInputSchema>;
export type ScreeningCheckOutput = z.infer<typeof screeningCheckOutputSchema>;
export type Match = z.infer<typeof matchSchema>;
export type EvidenceBundleItem = z.infer<typeof evidenceBundleItemSchema>;
export type ExposureChainInput = z.infer<typeof exposureChainInputSchema>;
export type ExposureChainOutput = z.infer<typeof exposureChainOutputSchema>;
export type ChainEntity = z.infer<typeof chainEntitySchema>;
export type JurisdictionRiskInput = z.infer<typeof jurisdictionRiskInputSchema>;
export type JurisdictionRiskOutput = z.infer<typeof jurisdictionRiskOutputSchema>;
export type RiskFactor = z.infer<typeof riskFactorSchema>;
