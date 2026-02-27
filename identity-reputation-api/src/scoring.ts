import type { Freshness, TrustComponent } from "./schemas";

export interface AgentData {
  registered: boolean;
  completedTasks: number;
  ratedTasks: number;
  totalStars: number;
  averageRating: number;
  totalEarnings: string;
  skills: string[];
  recentRatings: Array<{ taskId: string; rating: number; createdAt: string }>;
}

export interface ScoringConfig {
  stalenessThresholdSeconds: number;
  weights: {
    completionRate: number;
    ratingAverage: number;
    onchainIdentity: number;
    disputeHistory: number;
  };
}

export const DEFAULT_CONFIG: ScoringConfig = {
  stalenessThresholdSeconds: 300, // 5 minutes
  weights: {
    completionRate: 0.4,
    ratingAverage: 0.3,
    onchainIdentity: 0.2,
    disputeHistory: 0.1,
  },
};

export function computeFreshness(
  fetchedAt: Date,
  now: Date = new Date(),
  stalenessThreshold: number = DEFAULT_CONFIG.stalenessThresholdSeconds
): Freshness {
  const ageSeconds = Math.max(0, Math.floor((now.getTime() - fetchedAt.getTime()) / 1000));
  return {
    timestamp: fetchedAt.toISOString(),
    ageSeconds,
    stale: ageSeconds > stalenessThreshold,
  };
}

export function computeConfidence(data: AgentData): number {
  if (data.completedTasks === 0) return 0;
  // Confidence grows with data points, capped at 1.0
  // Uses log scale: ~0.5 at 5 tasks, ~0.75 at 20 tasks, ~0.9 at 50+ tasks
  const taskFactor = Math.min(1, Math.log10(data.completedTasks + 1) / Math.log10(100));
  const ratingFactor = data.ratedTasks > 0 ? Math.min(1, data.ratedTasks / data.completedTasks) : 0;
  return Math.round((taskFactor * 0.7 + ratingFactor * 0.3) * 100) / 100;
}

export function computeTrustScore(
  data: AgentData,
  config: ScoringConfig = DEFAULT_CONFIG
): number {
  const components = computeTrustComponents(data, config);
  const score = components.reduce((sum, c) => sum + c.score * c.weight, 0);
  return Math.round(score * 100) / 100;
}

export function computeTrustComponents(
  data: AgentData,
  config: ScoringConfig = DEFAULT_CONFIG
): TrustComponent[] {
  const { weights } = config;

  const completionScore = data.completedTasks > 0 ? 100 : 0;
  const ratingScore = data.averageRating; // already 0-100
  const identityScore = data.registered ? 100 : 0;
  // Dispute rate: lower is better. With no dispute data yet, assume 0 disputes = 100
  const disputeScore = 100;

  return [
    {
      component: "completion_rate",
      score: completionScore,
      weight: weights.completionRate,
      dataPoints: data.completedTasks,
      evidenceUrls: [],
    },
    {
      component: "rating_average",
      score: ratingScore,
      weight: weights.ratingAverage,
      dataPoints: data.ratedTasks,
      evidenceUrls: [],
    },
    {
      component: "onchain_identity",
      score: identityScore,
      weight: weights.onchainIdentity,
      dataPoints: data.registered ? 1 : 0,
      evidenceUrls: [],
    },
    {
      component: "dispute_history",
      score: disputeScore,
      weight: weights.disputeHistory,
      dataPoints: 0,
      evidenceUrls: [],
    },
  ];
}

export function computeCompletionRate(data: AgentData): number {
  if (data.completedTasks === 0) return 0;
  // Without total attempted tasks, completion rate based on having completed any
  return 1.0;
}

export function computeDisputeRate(_data: AgentData): number {
  // No dispute data available yet in the Taskmarket API
  return 0;
}

export function getIdentityState(registered: boolean): "registered" | "unregistered" | "revoked" {
  return registered ? "registered" : "unregistered";
}
