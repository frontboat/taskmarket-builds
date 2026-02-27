import type {
  Freshness,
  Match,
  EvidenceBundleItem,
  ChainEntity,
  RiskFactor,
} from "./schemas";

// --- Deterministic seed from string ---

export function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash);
}

// Deterministic pseudo-random from seed (simple LCG)
export function seededRandom(seed: number, index: number = 0): number {
  let s = seed + index * 7919;
  s = ((s * 1103515245 + 12345) & 0x7fffffff);
  return (s % 10000) / 10000;
}

// --- Freshness ---

export interface ScreeningConfig {
  stalenessThresholdSeconds: number;
}

export const DEFAULT_CONFIG: ScreeningConfig = {
  stalenessThresholdSeconds: 300,
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

// --- Screening Check Logic ---

const SANCTIONS_LISTS = [
  "OFAC SDN List",
  "EU Consolidated Sanctions List",
  "UN Security Council Sanctions",
  "UK HM Treasury Sanctions",
  "FATF Blacklist",
];

const PEP_LISTS = [
  "World Leaders Database",
  "Global PEP Registry",
  "National PEP Lists",
];

const WATCHLISTS = [
  "Interpol Red Notices",
  "FBI Most Wanted",
  "FinCEN Advisory",
];

const ADVERSE_MEDIA_SOURCES = [
  "Global Adverse Media Database",
  "Financial Crime News Index",
];

export type ListCategory = "sanctions" | "pep" | "adverse_media" | "watchlist";

export function computeNameMatchScore(entityName: string, matchedName: string): number {
  const a = entityName.toLowerCase().trim();
  const b = matchedName.toLowerCase().trim();

  if (a === b) return 1.0;

  // Check if one contains the other
  if (a.includes(b) || b.includes(a)) {
    const shorter = a.length < b.length ? a : b;
    const longer = a.length >= b.length ? a : b;
    return Math.round((shorter.length / longer.length) * 100) / 100;
  }

  // Simple token overlap score
  const tokensA = a.split(/\s+/);
  const tokensB = b.split(/\s+/);
  const intersection = tokensA.filter((t) => tokensB.includes(t));
  const union = new Set([...tokensA, ...tokensB]);
  if (union.size === 0) return 0;
  return Math.round((intersection.length / union.size) * 100) / 100;
}

export function generateDeterministicMatches(
  entityName: string,
  entityType: "individual" | "organization"
): Match[] {
  const seed = hashSeed(entityName);
  const matchCount = seed % 4; // 0-3 matches

  if (matchCount === 0) return [];

  const matches: Match[] = [];
  const allLists = [...SANCTIONS_LISTS, ...PEP_LISTS, ...WATCHLISTS, ...ADVERSE_MEDIA_SOURCES];
  const categories: ListCategory[] = ["sanctions", "pep", "watchlist", "adverse_media"];

  for (let i = 0; i < matchCount; i++) {
    const listIdx = (seed + i * 3) % allLists.length;
    const catIdx = (seed + i * 5) % categories.length;
    const r = seededRandom(seed, i);

    // Generate a plausible matched name variation
    const nameParts = entityName.split(/\s+/);
    let matchedName: string;
    if (r > 0.5 && nameParts.length > 1) {
      // Swap order of name parts
      matchedName = [...nameParts].reverse().join(" ");
    } else {
      matchedName = entityName;
    }

    const matchScore = computeNameMatchScore(entityName, matchedName);

    // Deterministic listedSince date
    const yearOffset = (seed + i) % 10;
    const monthOffset = (seed + i * 2) % 12;
    const listedSince = new Date(Date.UTC(2015 + yearOffset, monthOffset, 1));

    matches.push({
      listName: allLists[listIdx],
      matchedName,
      matchScore,
      listCategory: categories[catIdx],
      listedSince: listedSince.toISOString(),
    });
  }

  return matches;
}

export function determineScreeningStatus(
  matches: Match[]
): "clear" | "match" | "potential_match" | "inconclusive" {
  if (matches.length === 0) return "clear";

  const maxScore = Math.max(...matches.map((m) => m.matchScore));

  if (maxScore >= 0.9) return "match";
  if (maxScore >= 0.6) return "potential_match";
  return "inconclusive";
}

export function computeMatchConfidence(matches: Match[]): number {
  if (matches.length === 0) return 1.0; // high confidence it's clear

  const maxScore = Math.max(...matches.map((m) => m.matchScore));
  // Confidence in the result: high match score = high confidence, middle range = lower confidence
  if (maxScore >= 0.9) return 0.95;
  if (maxScore >= 0.7) return 0.75;
  if (maxScore >= 0.5) return 0.6;
  return 0.4;
}

export function computeScreeningConfidence(
  matches: Match[],
  hasIdentifiers: boolean,
  hasAddresses: boolean
): number {
  let base = 0.5;
  if (hasIdentifiers) base += 0.2;
  if (hasAddresses) base += 0.15;
  if (matches.length > 0) {
    base += 0.1;
  }
  return Math.min(1.0, Math.round(base * 100) / 100);
}

export function generateEvidenceBundle(
  entityName: string,
  matches: Match[]
): EvidenceBundleItem[] {
  const seed = hashSeed(entityName);
  const now = new Date().toISOString();

  const evidence: EvidenceBundleItem[] = [
    {
      source: "Global Sanctions Database",
      reference: `GSD-${seed % 100000}`,
      retrievedAt: now,
    },
  ];

  if (matches.length > 0) {
    for (let i = 0; i < Math.min(matches.length, 3); i++) {
      evidence.push({
        source: matches[i].listName,
        reference: `REF-${(seed + i * 17) % 99999}`,
        retrievedAt: now,
      });
    }
  }

  return evidence;
}

// --- Exposure Chain Logic ---

const RELATIONSHIP_TYPES = ["owner", "controller", "beneficiary", "associate"] as const;
const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;

export function generateExposureChain(
  address: string,
  ownershipDepth: number
): ChainEntity[] {
  const seed = hashSeed(address);
  const chain: ChainEntity[] = [];

  for (let depth = 1; depth <= ownershipDepth; depth++) {
    const entitiesAtDepth = 1 + ((seed + depth) % 3); // 1-3 entities per depth

    for (let j = 0; j < entitiesAtDepth; j++) {
      const idx = seed + depth * 100 + j * 10;
      const relIdx = idx % RELATIONSHIP_TYPES.length;
      const riskIdx = idx % RISK_LEVELS.length;

      // Generate deterministic entity address
      const entityHash = hashSeed(`${address}-${depth}-${j}`);
      const entityAddress = `0x${entityHash.toString(16).padStart(40, "0").slice(0, 40)}`;

      chain.push({
        entity: entityAddress,
        relationship: RELATIONSHIP_TYPES[relIdx],
        riskLevel: RISK_LEVELS[riskIdx],
        depth,
      });
    }
  }

  return chain;
}

export function computeAggregateRisk(
  chain: ChainEntity[]
): "low" | "medium" | "high" | "critical" {
  if (chain.length === 0) return "low";

  const riskMap: Record<string, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  };

  const maxRisk = Math.max(...chain.map((e) => riskMap[e.riskLevel]));

  // Aggregate also considers volume
  const avgRisk = chain.reduce((sum, e) => sum + riskMap[e.riskLevel], 0) / chain.length;

  // Weighted: 70% max risk, 30% average
  const composite = maxRisk * 0.7 + avgRisk * 0.3;

  if (composite >= 2.5) return "critical";
  if (composite >= 1.5) return "high";
  if (composite >= 0.5) return "medium";
  return "low";
}

// --- Jurisdiction Risk Logic ---

// Deterministic jurisdiction risk data
const HIGH_RISK_JURISDICTIONS: Record<string, { baseScore: number; programs: string[] }> = {
  KP: { baseScore: 95, programs: ["DPRK Sanctions", "UN SC Res 1718", "UN SC Res 2397"] },
  IR: { baseScore: 90, programs: ["Iran Sanctions", "JCPOA Related", "IRGC Sanctions"] },
  SY: { baseScore: 88, programs: ["Syria Sanctions", "Caesar Act"] },
  CU: { baseScore: 75, programs: ["Cuba Embargo", "OFAC Cuba Program"] },
  RU: { baseScore: 78, programs: ["Russia Sanctions", "CAATSA", "Executive Order 14024"] },
  BY: { baseScore: 72, programs: ["Belarus Sanctions", "EU Belarus Sanctions"] },
  VE: { baseScore: 68, programs: ["Venezuela Sanctions", "Executive Order 13884"] },
  MM: { baseScore: 65, programs: ["Myanmar/Burma Sanctions"] },
  SD: { baseScore: 62, programs: ["Sudan Sanctions"] },
  AF: { baseScore: 70, programs: ["Afghanistan Taliban Sanctions"] },
};

const MEDIUM_RISK_JURISDICTIONS = new Set([
  "CN", "PK", "LB", "IQ", "LY", "YE", "SO", "ER", "ZW", "NI",
  "HT", "CD", "CF", "ML", "BF", "NE", "TD", "NG",
]);

export function computeJurisdictionRiskScore(
  jurisdiction: string,
  industry?: string
): number {
  const high = HIGH_RISK_JURISDICTIONS[jurisdiction];
  if (high) {
    let score = high.baseScore;
    if (industry) {
      const industryMod = hashSeed(industry) % 10 - 5; // -5 to +4
      score = Math.max(0, Math.min(100, score + industryMod));
    }
    return Math.round(score * 100) / 100;
  }

  if (MEDIUM_RISK_JURISDICTIONS.has(jurisdiction)) {
    const base = 30 + (hashSeed(jurisdiction) % 25); // 30-54
    if (industry) {
      const industryMod = hashSeed(industry) % 10 - 5;
      return Math.max(0, Math.min(100, Math.round((base + industryMod) * 100) / 100));
    }
    return base;
  }

  // Low risk
  const base = 5 + (hashSeed(jurisdiction) % 20); // 5-24
  if (industry) {
    const industryMod = hashSeed(industry) % 8 - 4;
    return Math.max(0, Math.min(100, Math.round((base + industryMod) * 100) / 100));
  }
  return base;
}

export function computeJurisdictionRiskLevel(
  score: number
): "low" | "medium" | "high" | "critical" {
  if (score >= 80) return "critical";
  if (score >= 55) return "high";
  if (score >= 25) return "medium";
  return "low";
}

export function generateRiskFactors(
  jurisdiction: string,
  industry?: string
): RiskFactor[] {
  const seed = hashSeed(jurisdiction);
  const factors: RiskFactor[] = [];

  // AML/CFT framework strength
  const amlScore = 20 + (seed % 60);
  factors.push({
    factor: "AML/CFT Framework",
    score: amlScore,
    description: `Assessment of anti-money laundering and counter-terrorism financing regulatory framework strength for ${jurisdiction}`,
  });

  // Political stability
  const politicalScore = 15 + ((seed + 1) % 65);
  factors.push({
    factor: "Political Stability",
    score: politicalScore,
    description: `Political stability and governance quality index for ${jurisdiction}`,
  });

  // Corruption perception
  const corruptionScore = 10 + ((seed + 2) % 70);
  factors.push({
    factor: "Corruption Perception",
    score: corruptionScore,
    description: `Corruption perception index and transparency rating for ${jurisdiction}`,
  });

  // Regulatory enforcement
  const enforcementScore = 25 + ((seed + 3) % 55);
  factors.push({
    factor: "Regulatory Enforcement",
    score: enforcementScore,
    description: `Effectiveness of regulatory enforcement mechanisms in ${jurisdiction}`,
  });

  if (industry) {
    const industrySeed = hashSeed(industry);
    const industryScore = 20 + (industrySeed % 50);
    factors.push({
      factor: `Industry Risk: ${industry}`,
      score: industryScore,
      description: `Sector-specific risk assessment for ${industry} operating in ${jurisdiction}`,
    });
  }

  return factors;
}

export function getSanctionsPrograms(jurisdiction: string): string[] {
  const high = HIGH_RISK_JURISDICTIONS[jurisdiction];
  if (high) return high.programs;

  if (MEDIUM_RISK_JURISDICTIONS.has(jurisdiction)) {
    return [`${jurisdiction} Country Monitoring Program`];
  }

  return [];
}

export function computeLastUpdated(jurisdiction: string): string {
  // Deterministic last_updated based on jurisdiction
  const seed = hashSeed(jurisdiction);
  const dayOffset = seed % 30;
  const date = new Date(Date.UTC(2025, 0, 1 + dayOffset));
  return date.toISOString();
}
