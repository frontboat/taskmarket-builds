import { z } from "zod";

// --- Shared ---

export const freshnessSchema = z.object({
  timestamp: z.string().datetime(),
  ageSeconds: z.number().nonnegative(),
  stale: z.boolean(),
});

export const jurisdictionSchema = z.string().min(2).max(3).regex(/^[A-Z]{2,3}$/, "Must be ISO-3166 country code (e.g. US, GB, DE)");

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be ISO date (YYYY-MM-DD)");

export const semanticChangeTypeSchema = z.enum([
  "new_rule",
  "amendment",
  "repeal",
  "guidance_update",
  "enforcement_action",
]);

export const sourcePrioritySchema = z.enum(["official", "all"]).default("all");

export const controlFrameworkSchema = z.enum(["soc2", "iso27001", "nist", "gdpr", "all"]);

export const controlFrameworkStrictSchema = z.enum(["soc2", "iso27001", "nist", "gdpr"]);

export const impactLevelSchema = z.enum(["low", "medium", "high", "critical"]);

export const remediationUrgencySchema = z.enum(["immediate", "short_term", "planned"]);

export const estimatedEffortSchema = z.enum(["minimal", "moderate", "significant", "major"]);

export const gapStatusSchema = z.enum(["compliant", "partial_gap", "full_gap", "not_assessed"]);

// --- GET /v1/regulations/delta ---

export const deltaInputSchema = z.object({
  jurisdiction: jurisdictionSchema,
  industry: z.string().optional(),
  since: isoDateSchema,
  source_priority: sourcePrioritySchema,
});

export const deltaEntrySchema = z.object({
  ruleId: z.string().min(1),
  title: z.string().min(1),
  semantic_change_type: semanticChangeTypeSchema,
  summary: z.string().min(1),
  effective_date: isoDateSchema,
  published_date: isoDateSchema,
  source_url: z.string().url(),
  urgency_score: z.number().min(0).max(100),
});

export const deltaOutputSchema = z.object({
  jurisdiction: z.string(),
  deltas: z.array(deltaEntrySchema),
  total_changes: z.number().nonnegative().int(),
  freshness: freshnessSchema,
});

// --- GET /v1/regulations/impact ---

export const impactInputSchema = z.object({
  jurisdiction: jurisdictionSchema,
  industry: z.string().optional(),
  ruleId: z.string().optional(),
  control_framework: controlFrameworkSchema.default("all"),
});

export const impactEntrySchema = z.object({
  ruleId: z.string().min(1),
  title: z.string().min(1),
  affected_controls: z.array(z.string()),
  impact_level: impactLevelSchema,
  remediation_urgency: remediationUrgencySchema,
  estimated_effort: estimatedEffortSchema,
  description: z.string().min(1),
});

export const impactOutputSchema = z.object({
  jurisdiction: z.string(),
  impacts: z.array(impactEntrySchema),
  total_impacts: z.number().nonnegative().int(),
  freshness: freshnessSchema,
});

// --- POST /v1/regulations/map-controls ---

export const mapControlsInputSchema = z.object({
  ruleId: z.string().min(1),
  control_framework: controlFrameworkStrictSchema,
  jurisdiction: jurisdictionSchema,
});

export const mappedControlSchema = z.object({
  controlId: z.string().min(1),
  controlName: z.string().min(1),
  mapping_confidence: z.number().min(0).max(1),
  gap_status: gapStatusSchema,
  remediation_steps: z.array(z.string()),
});

export const mapControlsOutputSchema = z.object({
  ruleId: z.string(),
  control_framework: z.string(),
  jurisdiction: z.string(),
  mapped_controls: z.array(mappedControlSchema),
  total_mapped: z.number().nonnegative().int(),
  coverage_score: z.number().min(0).max(1),
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
export type DeltaInput = z.infer<typeof deltaInputSchema>;
export type DeltaEntry = z.infer<typeof deltaEntrySchema>;
export type DeltaOutput = z.infer<typeof deltaOutputSchema>;
export type ImpactInput = z.infer<typeof impactInputSchema>;
export type ImpactEntry = z.infer<typeof impactEntrySchema>;
export type ImpactOutput = z.infer<typeof impactOutputSchema>;
export type MapControlsInput = z.infer<typeof mapControlsInputSchema>;
export type MappedControl = z.infer<typeof mappedControlSchema>;
export type MapControlsOutput = z.infer<typeof mapControlsOutputSchema>;
export type SemanticChangeType = z.infer<typeof semanticChangeTypeSchema>;
export type ControlFramework = z.infer<typeof controlFrameworkSchema>;
export type ImpactLevel = z.infer<typeof impactLevelSchema>;
export type RemediationUrgency = z.infer<typeof remediationUrgencySchema>;
export type EstimatedEffort = z.infer<typeof estimatedEffortSchema>;
export type GapStatus = z.infer<typeof gapStatusSchema>;
