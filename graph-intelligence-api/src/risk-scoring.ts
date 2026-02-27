import type { Freshness, RiskFactor, RiskLevel, PathEdge, EntityType } from "./schemas";

// --- Types ---

export interface AddressRiskData {
  address: string;
  transactionCount: number;
  uniqueCounterparties: number;
  mixerInteractions: number;
  bridgeUsage: number;
  sanctionedProximityHops: number;
  accountAgeDays: number;
  volumeUsd: number;
}

export interface ScoringConfig {
  stalenessThresholdSeconds: number;
  weights: {
    mixer_interaction: number;
    bridge_usage: number;
    transaction_velocity: number;
    counterparty_diversity: number;
    account_age: number;
  };
}

export const DEFAULT_CONFIG: ScoringConfig = {
  stalenessThresholdSeconds: 300, // 5 minutes
  weights: {
    mixer_interaction: 0.30,
    bridge_usage: 0.20,
    transaction_velocity: 0.20,
    counterparty_diversity: 0.15,
    account_age: 0.15,
  },
};

// --- Deterministic seed from address ---

export function addressToSeed(address: string): number {
  const normalized = address.toLowerCase();
  // Simple hash: sum of char codes with a mixing step
  let hash = 0;
  for (let i = 2; i < normalized.length; i++) {
    const ch = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  // Ensure positive
  return Math.abs(hash);
}

// Deterministic pseudo-random from seed, returns [0, 1)
function seededRandom(seed: number, offset: number = 0): number {
  let s = ((seed + offset) * 2654435761) | 0;
  s = ((s ^ (s >>> 16)) * 2246822507) | 0;
  s = ((s ^ (s >>> 13)) * 3266489917) | 0;
  s = s ^ (s >>> 16);
  return Math.abs(s) / 2147483647;
}

// --- Freshness ---

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

// --- Risk Score ---

export function computeRiskScore(address: string): number {
  const factors = computeRiskFactors(address);
  const score = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
  return Math.round(score * 100) / 100;
}

// --- Risk Level ---

export function computeRiskLevel(score: number): RiskLevel {
  if (score <= 25) return "low";
  if (score <= 50) return "medium";
  if (score <= 75) return "high";
  return "critical";
}

// --- Risk Factors ---

export function computeRiskFactors(address: string): RiskFactor[] {
  const seed = addressToSeed(address);

  const mixerScore = Math.round(seededRandom(seed, 1) * 100 * 100) / 100;
  const bridgeScore = Math.round(seededRandom(seed, 2) * 100 * 100) / 100;
  const velocityScore = Math.round(seededRandom(seed, 3) * 100 * 100) / 100;
  const diversityScore = Math.round(seededRandom(seed, 4) * 100 * 100) / 100;
  const ageScore = Math.round(seededRandom(seed, 5) * 100 * 100) / 100;

  const w = DEFAULT_CONFIG.weights;

  return [
    {
      factor: "mixer_interaction",
      score: mixerScore,
      weight: w.mixer_interaction,
      description: "Interaction proximity with known mixing services",
    },
    {
      factor: "bridge_usage",
      score: bridgeScore,
      weight: w.bridge_usage,
      description: "Cross-chain bridge activity frequency and patterns",
    },
    {
      factor: "transaction_velocity",
      score: velocityScore,
      weight: w.transaction_velocity,
      description: "Unusual transaction frequency or volume spikes",
    },
    {
      factor: "counterparty_diversity",
      score: diversityScore,
      weight: w.counterparty_diversity,
      description: "Concentration risk from limited counterparty set",
    },
    {
      factor: "account_age",
      score: ageScore,
      weight: w.account_age,
      description: "Account maturity and on-chain history depth",
    },
  ];
}

// --- Sanctions Proximity ---

export function computeSanctionsProximity(address: string): number {
  const seed = addressToSeed(address);
  // Returns a value between 0 and 1, weighted towards lower values
  const raw = seededRandom(seed, 10);
  return Math.round(raw * raw * 100) / 100; // squared to skew towards 0
}

// --- Confidence ---

export function computeConfidence(address: string): number {
  const seed = addressToSeed(address);
  // Confidence between 0.3 and 0.95
  const raw = seededRandom(seed, 20);
  return Math.round((0.3 + raw * 0.65) * 100) / 100;
}

// --- Exposure Paths ---

const RELATIONSHIP_TYPES = [
  "direct_transfer",
  "defi_interaction",
  "bridge_relay",
  "token_swap",
  "contract_call",
  "mixer_deposit",
];

export function computeExposurePaths(
  address: string,
  maxHops: number,
  threshold: number
): PathEdge[] {
  const seed = addressToSeed(address);
  const allEdges: PathEdge[] = [];

  // Deterministic number of hops based on seed (1 to maxHops)
  const numHops = Math.min(maxHops, 1 + Math.floor(seededRandom(seed, 30) * maxHops));

  let currentFrom = address.toLowerCase();

  for (let hop = 1; hop <= numHops; hop++) {
    const hopSeed = seed + hop * 100;
    const riskContribution = Math.round(seededRandom(hopSeed, 1) * 100 * 100) / 100;

    const toBytes = seededRandom(hopSeed, 2).toString(16).slice(2, 42).padEnd(40, "0");
    const to = `0x${toBytes}`;
    const relIndex = Math.floor(seededRandom(hopSeed, 3) * RELATIONSHIP_TYPES.length);
    const relationship = RELATIONSHIP_TYPES[relIndex];

    allEdges.push({
      from: currentFrom,
      to,
      relationship,
      risk_contribution: riskContribution,
      hop,
    });

    currentFrom = to;
  }

  // Filter by threshold: keep edges whose risk_contribution meets the threshold
  // When threshold is 0, return all edges
  if (threshold === 0) return allEdges;
  return allEdges.filter((e) => e.risk_contribution >= threshold);
}

// --- Total Exposure ---

export function computeTotalExposure(paths: PathEdge[]): number {
  if (paths.length === 0) return 0;
  // Weighted average with decay per hop
  let totalWeightedRisk = 0;
  let totalWeight = 0;
  for (const p of paths) {
    const hopDecay = 1 / p.hop; // closer hops contribute more
    totalWeightedRisk += p.risk_contribution * hopDecay;
    totalWeight += hopDecay;
  }
  const exposure = totalWeight > 0 ? totalWeightedRisk / totalWeight : 0;
  return Math.min(100, Math.round(exposure * 100) / 100);
}

// --- Entity Profile ---

const ENTITY_TYPES: EntityType[] = [
  "individual",
  "exchange",
  "defi_protocol",
  "bridge",
  "mixer",
  "unknown",
];

const TAG_POOL = [
  "high_volume",
  "low_activity",
  "cex",
  "dex",
  "nft_trader",
  "yield_farmer",
  "governance",
  "airdrop_hunter",
  "whale",
  "bot",
  "fresh_account",
  "dormant",
];

export interface EntityProfileData {
  address: string;
  cluster_id: string;
  entity_type: EntityType;
  related_addresses: string[];
  transaction_volume_30d: string;
  first_seen: string;
  last_active: string;
  tags: string[];
  confidence: number;
}

export function computeEntityProfile(address: string): EntityProfileData {
  const seed = addressToSeed(address);

  // Cluster ID
  const clusterNum = Math.floor(seededRandom(seed, 40) * 100000);
  const cluster_id = `cluster_${clusterNum.toString(16).padStart(8, "0")}`;

  // Entity type
  const entityIndex = Math.floor(seededRandom(seed, 41) * ENTITY_TYPES.length);
  const entity_type = ENTITY_TYPES[entityIndex];

  // Related addresses (0-4)
  const numRelated = Math.floor(seededRandom(seed, 42) * 5);
  const related_addresses: string[] = [];
  for (let i = 0; i < numRelated; i++) {
    const addrBytes = seededRandom(seed, 50 + i).toString(16).slice(2, 42).padEnd(40, "0");
    related_addresses.push(`0x${addrBytes}`);
  }

  // Transaction volume
  const volumeRaw = seededRandom(seed, 43) * 10_000_000;
  const transaction_volume_30d = volumeRaw.toFixed(2);

  // Dates: first_seen between 2021 and 2024, last_active between first_seen and now
  const firstSeenMs = new Date("2021-01-01").getTime() +
    seededRandom(seed, 44) * (new Date("2024-01-01").getTime() - new Date("2021-01-01").getTime());
  const first_seen = new Date(firstSeenMs).toISOString();

  const lastActiveMs = firstSeenMs +
    seededRandom(seed, 45) * (new Date("2024-12-31").getTime() - firstSeenMs);
  const last_active = new Date(lastActiveMs).toISOString();

  // Tags (1-4)
  const numTags = 1 + Math.floor(seededRandom(seed, 46) * 4);
  const tags: string[] = [];
  const usedIndices = new Set<number>();
  for (let i = 0; i < numTags; i++) {
    let tagIdx = Math.floor(seededRandom(seed, 60 + i) * TAG_POOL.length);
    // Avoid duplicates
    while (usedIndices.has(tagIdx)) {
      tagIdx = (tagIdx + 1) % TAG_POOL.length;
    }
    usedIndices.add(tagIdx);
    tags.push(TAG_POOL[tagIdx]);
  }

  // Confidence
  const confidence = Math.round((0.3 + seededRandom(seed, 47) * 0.65) * 100) / 100;

  return {
    address,
    cluster_id,
    entity_type,
    related_addresses,
    transaction_volume_30d,
    first_seen,
    last_active,
    tags,
    confidence,
  };
}
