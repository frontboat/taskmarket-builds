import { describe, it, expect } from "bun:test";
import {
  computeRiskScore,
  computeRiskLevel,
  computeRiskFactors,
  computeSanctionsProximity,
  computeConfidence,
  computeExposurePaths,
  computeTotalExposure,
  computeEntityProfile,
  computeFreshness,
  addressToSeed,
  type AddressRiskData,
} from "../risk-scoring";
import {
  riskScoreOutputSchema,
  exposurePathsOutputSchema,
  entityProfileOutputSchema,
} from "../schemas";

// --- Deterministic Seeding ---

describe("addressToSeed", () => {
  it("produces a number from a valid address", () => {
    const seed = addressToSeed("0x1234567890abcdef1234567890abcdef12345678");
    expect(typeof seed).toBe("number");
    expect(Number.isFinite(seed)).toBe(true);
  });

  it("produces the same seed for the same address", () => {
    const addr = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
    expect(addressToSeed(addr)).toBe(addressToSeed(addr));
  });

  it("produces different seeds for different addresses", () => {
    const seed1 = addressToSeed("0x1111111111111111111111111111111111111111");
    const seed2 = addressToSeed("0x2222222222222222222222222222222222222222");
    expect(seed1).not.toBe(seed2);
  });

  it("is case insensitive", () => {
    const lower = addressToSeed("0xabcdef1234567890abcdef1234567890abcdef12");
    const upper = addressToSeed("0xABCDEF1234567890ABCDEF1234567890ABCDEF12");
    expect(lower).toBe(upper);
  });
});

// --- Risk Score Computation ---

describe("computeRiskScore", () => {
  it("returns a number between 0 and 100", () => {
    const score = computeRiskScore("0x1234567890abcdef1234567890abcdef12345678");
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("is deterministic - same address gives same score", () => {
    const addr = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    expect(computeRiskScore(addr)).toBe(computeRiskScore(addr));
  });

  it("returns different scores for different addresses", () => {
    const s1 = computeRiskScore("0x1111111111111111111111111111111111111111");
    const s2 = computeRiskScore("0x2222222222222222222222222222222222222222");
    // Different addresses should usually produce different scores
    // (not guaranteed for all pairs, but these specific ones should differ)
    expect(s1).not.toBe(s2);
  });

  it("returns a rounded number (max 2 decimals)", () => {
    const score = computeRiskScore("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(Math.round(score * 100) / 100).toBe(score);
  });
});

// --- Risk Level ---

describe("computeRiskLevel", () => {
  it("returns 'low' for scores 0-25", () => {
    expect(computeRiskLevel(0)).toBe("low");
    expect(computeRiskLevel(10)).toBe("low");
    expect(computeRiskLevel(25)).toBe("low");
  });

  it("returns 'medium' for scores 26-50", () => {
    expect(computeRiskLevel(26)).toBe("medium");
    expect(computeRiskLevel(40)).toBe("medium");
    expect(computeRiskLevel(50)).toBe("medium");
  });

  it("returns 'high' for scores 51-75", () => {
    expect(computeRiskLevel(51)).toBe("high");
    expect(computeRiskLevel(60)).toBe("high");
    expect(computeRiskLevel(75)).toBe("high");
  });

  it("returns 'critical' for scores 76-100", () => {
    expect(computeRiskLevel(76)).toBe("critical");
    expect(computeRiskLevel(90)).toBe("critical");
    expect(computeRiskLevel(100)).toBe("critical");
  });
});

// --- Risk Factors ---

describe("computeRiskFactors", () => {
  it("returns an array of risk factors", () => {
    const factors = computeRiskFactors("0x1234567890abcdef1234567890abcdef12345678");
    expect(Array.isArray(factors)).toBe(true);
    expect(factors.length).toBeGreaterThan(0);
  });

  it("each factor has required fields", () => {
    const factors = computeRiskFactors("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");
    for (const f of factors) {
      expect(typeof f.factor).toBe("string");
      expect(f.score).toBeGreaterThanOrEqual(0);
      expect(f.score).toBeLessThanOrEqual(100);
      expect(f.weight).toBeGreaterThanOrEqual(0);
      expect(f.weight).toBeLessThanOrEqual(1);
      expect(typeof f.description).toBe("string");
    }
  });

  it("weights sum to approximately 1", () => {
    const factors = computeRiskFactors("0x1234567890abcdef1234567890abcdef12345678");
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 1);
  });

  it("is deterministic", () => {
    const addr = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    const f1 = computeRiskFactors(addr);
    const f2 = computeRiskFactors(addr);
    expect(f1).toEqual(f2);
  });
});

// --- Sanctions Proximity ---

describe("computeSanctionsProximity", () => {
  it("returns a number between 0 and 1", () => {
    const prox = computeSanctionsProximity("0x1234567890abcdef1234567890abcdef12345678");
    expect(prox).toBeGreaterThanOrEqual(0);
    expect(prox).toBeLessThanOrEqual(1);
  });

  it("is deterministic", () => {
    const addr = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    expect(computeSanctionsProximity(addr)).toBe(computeSanctionsProximity(addr));
  });
});

// --- Confidence ---

describe("computeConfidence", () => {
  it("returns a number between 0 and 1", () => {
    const conf = computeConfidence("0x1234567890abcdef1234567890abcdef12345678");
    expect(conf).toBeGreaterThanOrEqual(0);
    expect(conf).toBeLessThanOrEqual(1);
  });

  it("is deterministic", () => {
    const addr = "0xcccccccccccccccccccccccccccccccccccccccc";
    expect(computeConfidence(addr)).toBe(computeConfidence(addr));
  });
});

// --- Exposure Paths ---

describe("computeExposurePaths", () => {
  it("returns an array of path edges", () => {
    const paths = computeExposurePaths("0x1234567890abcdef1234567890abcdef12345678", 3, 50);
    expect(Array.isArray(paths)).toBe(true);
  });

  it("each edge has sequential hops starting from 1 (no threshold)", () => {
    const paths = computeExposurePaths("0x1234567890abcdef1234567890abcdef12345678", 3, 0);
    if (paths.length > 0) {
      const hops = paths.map((p) => p.hop);
      expect(hops[0]).toBe(1);
      for (let i = 1; i < hops.length; i++) {
        expect(hops[i]).toBe(hops[i - 1] + 1);
      }
    }
  });

  it("with threshold, hops are in ascending order", () => {
    const paths = computeExposurePaths("0x1234567890abcdef1234567890abcdef12345678", 3, 50);
    if (paths.length > 1) {
      for (let i = 1; i < paths.length; i++) {
        expect(paths[i].hop).toBeGreaterThan(paths[i - 1].hop);
      }
    }
  });

  it("respects maxHops limit", () => {
    const paths = computeExposurePaths("0x1234567890abcdef1234567890abcdef12345678", 2, 0);
    for (const p of paths) {
      expect(p.hop).toBeLessThanOrEqual(2);
    }
  });

  it("first edge starts from the queried address (no threshold)", () => {
    const addr = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const paths = computeExposurePaths(addr, 3, 0);
    if (paths.length > 0) {
      expect(paths[0].from.toLowerCase()).toBe(addr.toLowerCase());
    }
  });

  it("edges have valid risk_contribution values", () => {
    const paths = computeExposurePaths("0x1234567890abcdef1234567890abcdef12345678", 4, 0);
    for (const p of paths) {
      expect(p.risk_contribution).toBeGreaterThanOrEqual(0);
      expect(p.risk_contribution).toBeLessThanOrEqual(100);
    }
  });

  it("is deterministic", () => {
    const addr = "0xdddddddddddddddddddddddddddddddddddddd";
    const p1 = computeExposurePaths(addr, 3, 50);
    const p2 = computeExposurePaths(addr, 3, 50);
    expect(p1).toEqual(p2);
  });
});

// --- Total Exposure ---

describe("computeTotalExposure", () => {
  it("returns 0 for empty paths", () => {
    expect(computeTotalExposure([])).toBe(0);
  });

  it("returns a number between 0 and 100", () => {
    const paths = computeExposurePaths("0x1234567890abcdef1234567890abcdef12345678", 3, 50);
    const exposure = computeTotalExposure(paths);
    expect(exposure).toBeGreaterThanOrEqual(0);
    expect(exposure).toBeLessThanOrEqual(100);
  });
});

// --- Entity Profile ---

describe("computeEntityProfile", () => {
  it("returns a valid entity profile", () => {
    const profile = computeEntityProfile("0x1234567890abcdef1234567890abcdef12345678");
    expect(profile.address).toBe("0x1234567890abcdef1234567890abcdef12345678");
    expect(typeof profile.cluster_id).toBe("string");
    expect(profile.cluster_id.length).toBeGreaterThan(0);
  });

  it("entity_type is one of the valid types", () => {
    const profile = computeEntityProfile("0x1234567890abcdef1234567890abcdef12345678");
    const validTypes = ["individual", "exchange", "defi_protocol", "bridge", "mixer", "unknown"];
    expect(validTypes).toContain(profile.entity_type);
  });

  it("related_addresses are strings", () => {
    const profile = computeEntityProfile("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(Array.isArray(profile.related_addresses)).toBe(true);
    for (const addr of profile.related_addresses) {
      expect(typeof addr).toBe("string");
    }
  });

  it("transaction_volume_30d is a string", () => {
    const profile = computeEntityProfile("0x1234567890abcdef1234567890abcdef12345678");
    expect(typeof profile.transaction_volume_30d).toBe("string");
  });

  it("first_seen is before last_active", () => {
    const profile = computeEntityProfile("0x1234567890abcdef1234567890abcdef12345678");
    expect(new Date(profile.first_seen).getTime()).toBeLessThanOrEqual(
      new Date(profile.last_active).getTime()
    );
  });

  it("confidence is between 0 and 1", () => {
    const profile = computeEntityProfile("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    expect(profile.confidence).toBeGreaterThanOrEqual(0);
    expect(profile.confidence).toBeLessThanOrEqual(1);
  });

  it("is deterministic", () => {
    const addr = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    const p1 = computeEntityProfile(addr);
    const p2 = computeEntityProfile(addr);
    expect(p1).toEqual(p2);
  });

  it("output validates against entityProfileOutputSchema (minus freshness)", () => {
    const profile = computeEntityProfile("0x1234567890abcdef1234567890abcdef12345678");
    const withFreshness = {
      ...profile,
      freshness: { timestamp: new Date().toISOString(), ageSeconds: 0, stale: false },
    };
    expect(entityProfileOutputSchema.safeParse(withFreshness).success).toBe(true);
  });
});

// --- Freshness ---

describe("computeFreshness", () => {
  it("returns fresh data when fetched recently", () => {
    const now = new Date();
    const freshness = computeFreshness(now, now);
    expect(freshness.ageSeconds).toBe(0);
    expect(freshness.stale).toBe(false);
  });

  it("marks data as stale after threshold", () => {
    const fetchedAt = new Date("2024-01-01T00:00:00.000Z");
    const now = new Date("2024-01-01T00:10:00.000Z"); // 10 minutes later
    const freshness = computeFreshness(fetchedAt, now);
    expect(freshness.ageSeconds).toBe(600);
    expect(freshness.stale).toBe(true);
  });

  it("returns valid ISO timestamp", () => {
    const now = new Date();
    const freshness = computeFreshness(now);
    expect(() => new Date(freshness.timestamp)).not.toThrow();
  });
});

// --- Full Output Validation ---

describe("full output schema validation", () => {
  it("computeRiskScore + factors produce valid riskScoreOutput", () => {
    const addr = "0x1234567890abcdef1234567890abcdef12345678";
    const score = computeRiskScore(addr);
    const output = {
      address: addr,
      risk_score: score,
      risk_level: computeRiskLevel(score),
      risk_factors: computeRiskFactors(addr),
      sanctions_proximity: computeSanctionsProximity(addr),
      confidence: computeConfidence(addr),
      freshness: computeFreshness(new Date()),
    };
    expect(riskScoreOutputSchema.safeParse(output).success).toBe(true);
  });

  it("computeExposurePaths produces valid exposurePathsOutput", () => {
    const addr = "0x1234567890abcdef1234567890abcdef12345678";
    const paths = computeExposurePaths(addr, 3, 50);
    const output = {
      address: addr,
      paths,
      total_exposure: computeTotalExposure(paths),
      highest_risk_path_score: paths.length > 0 ? Math.max(...paths.map((p) => p.risk_contribution)) : 0,
      freshness: computeFreshness(new Date()),
    };
    expect(exposurePathsOutputSchema.safeParse(output).success).toBe(true);
  });
});
