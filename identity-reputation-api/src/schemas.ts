import { z } from "zod";

// --- Shared ---

export const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address");

export const freshnessSchema = z.object({
  timestamp: z.string().datetime(),
  ageSeconds: z.number().nonnegative(),
  stale: z.boolean(),
});

// --- GET /v1/identity/reputation ---

export const reputationInputSchema = z.object({
  agentAddress: addressSchema,
  chain: z.string().default("base"),
  timeframe: z.enum(["7d", "30d", "90d", "all"]).default("all"),
});

export const reputationOutputSchema = z.object({
  agentAddress: z.string(),
  trustScore: z.number().min(0).max(100),
  completionRate: z.number().min(0).max(1),
  disputeRate: z.number().min(0).max(1),
  totalTasks: z.number().nonnegative().int(),
  onchainIdentityState: z.enum(["registered", "unregistered", "revoked"]),
  confidence: z.number().min(0).max(1),
  freshness: freshnessSchema,
});

// --- GET /v1/identity/history ---

export const historyInputSchema = z.object({
  agentAddress: addressSchema,
  chain: z.string().default("base"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const historyEntrySchema = z.object({
  taskId: z.string(),
  role: z.enum(["requester", "worker"]),
  status: z.enum(["completed", "disputed", "expired", "cancelled"]),
  reward: z.string(),
  rating: z.number().min(0).max(100).nullable(),
  counterparty: z.string(),
  completedAt: z.string().datetime(),
  evidenceUrls: z.array(z.string().url()).default([]),
});

export const historyOutputSchema = z.object({
  agentAddress: z.string(),
  entries: z.array(historyEntrySchema),
  total: z.number().nonnegative().int(),
  freshness: freshnessSchema,
});

// --- GET /v1/identity/trust-breakdown ---

export const trustBreakdownInputSchema = z.object({
  agentAddress: addressSchema,
  chain: z.string().default("base"),
  evidenceDepth: z.coerce.number().int().min(1).max(10).default(3),
});

export const trustComponentSchema = z.object({
  component: z.string(),
  score: z.number().min(0).max(100),
  weight: z.number().min(0).max(1),
  dataPoints: z.number().nonnegative().int(),
  evidenceUrls: z.array(z.string().url()).default([]),
});

export const trustBreakdownOutputSchema = z.object({
  agentAddress: z.string(),
  overallTrustScore: z.number().min(0).max(100),
  components: z.array(trustComponentSchema),
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
export type ReputationInput = z.infer<typeof reputationInputSchema>;
export type ReputationOutput = z.infer<typeof reputationOutputSchema>;
export type HistoryInput = z.infer<typeof historyInputSchema>;
export type HistoryOutput = z.infer<typeof historyOutputSchema>;
export type HistoryEntry = z.infer<typeof historyEntrySchema>;
export type TrustBreakdownInput = z.infer<typeof trustBreakdownInputSchema>;
export type TrustBreakdownOutput = z.infer<typeof trustBreakdownOutputSchema>;
export type TrustComponent = z.infer<typeof trustComponentSchema>;
export type Freshness = z.infer<typeof freshnessSchema>;
