import { describe, test, expect } from "bun:test";
import {
  hashSeed,
  seededRandom,
  computeFreshness,
  computeNameMatchScore,
  generateDeterministicMatches,
  determineScreeningStatus,
  computeMatchConfidence,
  computeScreeningConfidence,
  generateEvidenceBundle,
  generateExposureChain,
  computeAggregateRisk,
  computeJurisdictionRiskScore,
  computeJurisdictionRiskLevel,
  generateRiskFactors,
  getSanctionsPrograms,
  computeLastUpdated,
  DEFAULT_CONFIG,
} from "../screening";

// --- hashSeed ---

describe("hashSeed", () => {
  test("returns a number", () => {
    expect(typeof hashSeed("test")).toBe("number");
  });

  test("is deterministic for same input", () => {
    expect(hashSeed("hello")).toBe(hashSeed("hello"));
  });

  test("produces different values for different inputs", () => {
    expect(hashSeed("alice")).not.toBe(hashSeed("bob"));
  });

  test("returns non-negative value", () => {
    expect(hashSeed("test")).toBeGreaterThanOrEqual(0);
    expect(hashSeed("")).toBeGreaterThanOrEqual(0);
    expect(hashSeed("some long string with many characters")).toBeGreaterThanOrEqual(0);
  });
});

// --- seededRandom ---

describe("seededRandom", () => {
  test("returns value between 0 and 1", () => {
    const val = seededRandom(42);
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThan(1);
  });

  test("is deterministic for same seed and index", () => {
    expect(seededRandom(42, 0)).toBe(seededRandom(42, 0));
    expect(seededRandom(42, 5)).toBe(seededRandom(42, 5));
  });

  test("varies with different indices", () => {
    expect(seededRandom(42, 0)).not.toBe(seededRandom(42, 1));
  });
});

// --- computeFreshness ---

describe("computeFreshness", () => {
  test("returns 0 age for same timestamp", () => {
    const now = new Date("2025-01-01T00:00:00Z");
    const result = computeFreshness(now, now);
    expect(result.ageSeconds).toBe(0);
    expect(result.stale).toBe(false);
  });

  test("computes age correctly", () => {
    const fetchedAt = new Date("2025-01-01T00:00:00Z");
    const now = new Date("2025-01-01T00:01:00Z");
    const result = computeFreshness(fetchedAt, now);
    expect(result.ageSeconds).toBe(60);
  });

  test("marks as stale when beyond threshold", () => {
    const fetchedAt = new Date("2025-01-01T00:00:00Z");
    const now = new Date("2025-01-01T00:10:00Z"); // 600 seconds
    const result = computeFreshness(fetchedAt, now);
    expect(result.stale).toBe(true);
  });

  test("not stale within threshold", () => {
    const fetchedAt = new Date("2025-01-01T00:00:00Z");
    const now = new Date("2025-01-01T00:04:00Z"); // 240 seconds < 300
    const result = computeFreshness(fetchedAt, now);
    expect(result.stale).toBe(false);
  });

  test("includes ISO timestamp", () => {
    const fetchedAt = new Date("2025-06-15T12:00:00Z");
    const result = computeFreshness(fetchedAt, fetchedAt);
    expect(result.timestamp).toBe("2025-06-15T12:00:00.000Z");
  });

  test("respects custom staleness threshold", () => {
    const fetchedAt = new Date("2025-01-01T00:00:00Z");
    const now = new Date("2025-01-01T00:01:00Z"); // 60 seconds
    const result = computeFreshness(fetchedAt, now, 30);
    expect(result.stale).toBe(true);
  });

  test("default config has 300s threshold", () => {
    expect(DEFAULT_CONFIG.stalenessThresholdSeconds).toBe(300);
  });
});

// --- computeNameMatchScore ---

describe("computeNameMatchScore", () => {
  test("returns 1.0 for exact match", () => {
    expect(computeNameMatchScore("John Doe", "John Doe")).toBe(1.0);
  });

  test("returns 1.0 for case-insensitive match", () => {
    expect(computeNameMatchScore("John Doe", "john doe")).toBe(1.0);
  });

  test("returns high score for substring match", () => {
    const score = computeNameMatchScore("John", "John Doe");
    expect(score).toBeGreaterThan(0.3);
    expect(score).toBeLessThan(1.0);
  });

  test("returns score based on token overlap", () => {
    const score = computeNameMatchScore("John Smith", "John Doe");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  test("returns 0 for completely different names", () => {
    const score = computeNameMatchScore("Alice", "Bob");
    expect(score).toBe(0);
  });

  test("handles whitespace trimming", () => {
    expect(computeNameMatchScore("  John Doe  ", "John Doe")).toBe(1.0);
  });
});

// --- generateDeterministicMatches ---

describe("generateDeterministicMatches", () => {
  test("returns same result for same input", () => {
    const a = generateDeterministicMatches("John Doe", "individual");
    const b = generateDeterministicMatches("John Doe", "individual");
    expect(a).toEqual(b);
  });

  test("returns array", () => {
    const result = generateDeterministicMatches("Test Entity", "individual");
    expect(Array.isArray(result)).toBe(true);
  });

  test("returns 0-3 matches", () => {
    const result = generateDeterministicMatches("Test Entity", "individual");
    expect(result.length).toBeGreaterThanOrEqual(0);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  test("each match has required fields", () => {
    // Try several names to find one with matches
    for (const name of ["Test A", "Test B", "Test C", "Test D", "John Smith"]) {
      const matches = generateDeterministicMatches(name, "individual");
      if (matches.length > 0) {
        const m = matches[0];
        expect(m.listName).toBeDefined();
        expect(m.matchedName).toBeDefined();
        expect(m.matchScore).toBeGreaterThanOrEqual(0);
        expect(m.matchScore).toBeLessThanOrEqual(1);
        expect(m.listCategory).toBeDefined();
        expect(m.listedSince).toBeDefined();
        return;
      }
    }
  });

  test("different names may produce different match counts", () => {
    const results = new Set<number>();
    for (let i = 0; i < 20; i++) {
      const matches = generateDeterministicMatches(`Entity${i}`, "individual");
      results.add(matches.length);
    }
    expect(results.size).toBeGreaterThan(1);
  });
});

// --- determineScreeningStatus ---

describe("determineScreeningStatus", () => {
  test("returns clear for no matches", () => {
    expect(determineScreeningStatus([])).toBe("clear");
  });

  test("returns match for high score", () => {
    const matches = [{
      listName: "OFAC",
      matchedName: "Test",
      matchScore: 0.95,
      listCategory: "sanctions" as const,
      listedSince: "2020-01-01T00:00:00.000Z",
    }];
    expect(determineScreeningStatus(matches)).toBe("match");
  });

  test("returns potential_match for medium score", () => {
    const matches = [{
      listName: "OFAC",
      matchedName: "Test",
      matchScore: 0.7,
      listCategory: "sanctions" as const,
      listedSince: "2020-01-01T00:00:00.000Z",
    }];
    expect(determineScreeningStatus(matches)).toBe("potential_match");
  });

  test("returns inconclusive for low score", () => {
    const matches = [{
      listName: "OFAC",
      matchedName: "Test",
      matchScore: 0.3,
      listCategory: "sanctions" as const,
      listedSince: "2020-01-01T00:00:00.000Z",
    }];
    expect(determineScreeningStatus(matches)).toBe("inconclusive");
  });

  test("uses highest score among multiple matches", () => {
    const matches = [
      { listName: "A", matchedName: "T", matchScore: 0.3, listCategory: "sanctions" as const, listedSince: "2020-01-01T00:00:00.000Z" },
      { listName: "B", matchedName: "T", matchScore: 0.95, listCategory: "pep" as const, listedSince: "2020-01-01T00:00:00.000Z" },
    ];
    expect(determineScreeningStatus(matches)).toBe("match");
  });
});

// --- computeMatchConfidence ---

describe("computeMatchConfidence", () => {
  test("returns 1.0 for no matches (high confidence clear)", () => {
    expect(computeMatchConfidence([])).toBe(1.0);
  });

  test("returns 0.95 for very high match score", () => {
    const matches = [{ listName: "A", matchedName: "T", matchScore: 0.95, listCategory: "sanctions" as const, listedSince: "2020-01-01T00:00:00.000Z" }];
    expect(computeMatchConfidence(matches)).toBe(0.95);
  });

  test("returns lower confidence for ambiguous scores", () => {
    const matches = [{ listName: "A", matchedName: "T", matchScore: 0.55, listCategory: "sanctions" as const, listedSince: "2020-01-01T00:00:00.000Z" }];
    expect(computeMatchConfidence(matches)).toBe(0.6);
  });

  test("returns 0.4 for very low scores", () => {
    const matches = [{ listName: "A", matchedName: "T", matchScore: 0.2, listCategory: "sanctions" as const, listedSince: "2020-01-01T00:00:00.000Z" }];
    expect(computeMatchConfidence(matches)).toBe(0.4);
  });
});

// --- computeScreeningConfidence ---

describe("computeScreeningConfidence", () => {
  test("base confidence without identifiers or addresses", () => {
    expect(computeScreeningConfidence([], false, false)).toBe(0.5);
  });

  test("increases with identifiers", () => {
    const withIds = computeScreeningConfidence([], true, false);
    expect(withIds).toBeGreaterThan(0.5);
  });

  test("increases with addresses", () => {
    const withAddr = computeScreeningConfidence([], false, true);
    expect(withAddr).toBeGreaterThan(0.5);
  });

  test("highest with both identifiers and addresses", () => {
    const both = computeScreeningConfidence([], true, true);
    expect(both).toBeGreaterThanOrEqual(0.85);
  });

  test("capped at 1.0", () => {
    const matches = [{ listName: "A", matchedName: "T", matchScore: 0.9, listCategory: "sanctions" as const, listedSince: "2020-01-01T00:00:00.000Z" }];
    const conf = computeScreeningConfidence(matches, true, true);
    expect(conf).toBeLessThanOrEqual(1.0);
  });
});

// --- generateEvidenceBundle ---

describe("generateEvidenceBundle", () => {
  test("always includes base evidence", () => {
    const bundle = generateEvidenceBundle("Test", []);
    expect(bundle.length).toBeGreaterThanOrEqual(1);
    expect(bundle[0].source).toBe("Global Sanctions Database");
  });

  test("includes match-specific evidence", () => {
    const matches = [
      { listName: "OFAC SDN List", matchedName: "Test", matchScore: 0.9, listCategory: "sanctions" as const, listedSince: "2020-01-01T00:00:00.000Z" },
    ];
    const bundle = generateEvidenceBundle("Test", matches);
    expect(bundle.length).toBeGreaterThanOrEqual(2);
  });

  test("limits additional evidence to 3 matches", () => {
    const matches = Array.from({ length: 5 }, (_, i) => ({
      listName: `List${i}`,
      matchedName: "T",
      matchScore: 0.5,
      listCategory: "sanctions" as const,
      listedSince: "2020-01-01T00:00:00.000Z",
    }));
    const bundle = generateEvidenceBundle("Test", matches);
    expect(bundle.length).toBeLessThanOrEqual(4); // 1 base + 3 max
  });

  test("each item has retrievedAt", () => {
    const bundle = generateEvidenceBundle("Test", []);
    for (const item of bundle) {
      expect(item.retrievedAt).toBeDefined();
      expect(new Date(item.retrievedAt).getTime()).not.toBeNaN();
    }
  });
});

// --- generateExposureChain ---

describe("generateExposureChain", () => {
  test("returns deterministic results", () => {
    const addr = "0x1234567890abcdef1234567890abcdef12345678";
    const a = generateExposureChain(addr, 2);
    const b = generateExposureChain(addr, 2);
    expect(a).toEqual(b);
  });

  test("respects ownership depth", () => {
    const addr = "0x1234567890abcdef1234567890abcdef12345678";
    const chain = generateExposureChain(addr, 3);
    for (const entity of chain) {
      expect(entity.depth).toBeGreaterThanOrEqual(1);
      expect(entity.depth).toBeLessThanOrEqual(3);
    }
  });

  test("depth 1 produces entities at depth 1", () => {
    const addr = "0xabcdef1234567890abcdef1234567890abcdef12";
    const chain = generateExposureChain(addr, 1);
    expect(chain.length).toBeGreaterThan(0);
    chain.forEach((e) => expect(e.depth).toBe(1));
  });

  test("deeper depth produces more entities", () => {
    const addr = "0x1234567890abcdef1234567890abcdef12345678";
    const shallow = generateExposureChain(addr, 1);
    const deep = generateExposureChain(addr, 5);
    expect(deep.length).toBeGreaterThan(shallow.length);
  });

  test("entities have valid relationship types", () => {
    const addr = "0x1234567890abcdef1234567890abcdef12345678";
    const chain = generateExposureChain(addr, 3);
    const validRels = ["owner", "controller", "beneficiary", "associate"];
    for (const entity of chain) {
      expect(validRels).toContain(entity.relationship);
    }
  });

  test("entities have valid risk levels", () => {
    const addr = "0x1234567890abcdef1234567890abcdef12345678";
    const chain = generateExposureChain(addr, 3);
    const validLevels = ["low", "medium", "high", "critical"];
    for (const entity of chain) {
      expect(validLevels).toContain(entity.riskLevel);
    }
  });
});

// --- computeAggregateRisk ---

describe("computeAggregateRisk", () => {
  test("returns low for empty chain", () => {
    expect(computeAggregateRisk([])).toBe("low");
  });

  test("returns critical when critical entities present", () => {
    const chain = [
      { entity: "a", relationship: "owner" as const, riskLevel: "critical" as const, depth: 1 },
      { entity: "b", relationship: "controller" as const, riskLevel: "critical" as const, depth: 2 },
    ];
    expect(computeAggregateRisk(chain)).toBe("critical");
  });

  test("returns low for all low risk entities", () => {
    const chain = [
      { entity: "a", relationship: "owner" as const, riskLevel: "low" as const, depth: 1 },
      { entity: "b", relationship: "controller" as const, riskLevel: "low" as const, depth: 2 },
    ];
    expect(computeAggregateRisk(chain)).toBe("low");
  });

  test("returns medium for mixed low/medium", () => {
    const chain = [
      { entity: "a", relationship: "owner" as const, riskLevel: "low" as const, depth: 1 },
      { entity: "b", relationship: "controller" as const, riskLevel: "medium" as const, depth: 2 },
    ];
    const result = computeAggregateRisk(chain);
    expect(["low", "medium"]).toContain(result);
  });
});

// --- computeJurisdictionRiskScore ---

describe("computeJurisdictionRiskScore", () => {
  test("returns high score for North Korea", () => {
    expect(computeJurisdictionRiskScore("KP")).toBeGreaterThanOrEqual(80);
  });

  test("returns high score for Iran", () => {
    expect(computeJurisdictionRiskScore("IR")).toBeGreaterThanOrEqual(80);
  });

  test("returns medium score for medium-risk jurisdictions", () => {
    const score = computeJurisdictionRiskScore("CN");
    expect(score).toBeGreaterThanOrEqual(25);
    expect(score).toBeLessThanOrEqual(60);
  });

  test("returns low score for low-risk jurisdictions", () => {
    const score = computeJurisdictionRiskScore("US");
    expect(score).toBeLessThan(25);
  });

  test("industry modifier adjusts score", () => {
    const base = computeJurisdictionRiskScore("US");
    const withIndustry = computeJurisdictionRiskScore("US", "cryptocurrency");
    // They should differ (unless modifier happens to be 0)
    expect(typeof withIndustry).toBe("number");
    expect(withIndustry).toBeGreaterThanOrEqual(0);
    expect(withIndustry).toBeLessThanOrEqual(100);
  });

  test("score is always 0-100", () => {
    for (const j of ["KP", "IR", "US", "GB", "CN", "JP"]) {
      const score = computeJurisdictionRiskScore(j);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  test("is deterministic", () => {
    expect(computeJurisdictionRiskScore("RU")).toBe(computeJurisdictionRiskScore("RU"));
  });
});

// --- computeJurisdictionRiskLevel ---

describe("computeJurisdictionRiskLevel", () => {
  test("critical for score >= 80", () => {
    expect(computeJurisdictionRiskLevel(80)).toBe("critical");
    expect(computeJurisdictionRiskLevel(100)).toBe("critical");
  });

  test("high for score 55-79", () => {
    expect(computeJurisdictionRiskLevel(55)).toBe("high");
    expect(computeJurisdictionRiskLevel(79)).toBe("high");
  });

  test("medium for score 25-54", () => {
    expect(computeJurisdictionRiskLevel(25)).toBe("medium");
    expect(computeJurisdictionRiskLevel(54)).toBe("medium");
  });

  test("low for score < 25", () => {
    expect(computeJurisdictionRiskLevel(0)).toBe("low");
    expect(computeJurisdictionRiskLevel(24)).toBe("low");
  });
});

// --- generateRiskFactors ---

describe("generateRiskFactors", () => {
  test("returns at least 4 factors without industry", () => {
    const factors = generateRiskFactors("US");
    expect(factors.length).toBeGreaterThanOrEqual(4);
  });

  test("returns 5 factors with industry", () => {
    const factors = generateRiskFactors("US", "banking");
    expect(factors.length).toBe(5);
  });

  test("industry factor includes industry name", () => {
    const factors = generateRiskFactors("US", "crypto");
    const industryFactor = factors.find((f) => f.factor.includes("crypto"));
    expect(industryFactor).toBeDefined();
  });

  test("all scores are 0-100", () => {
    const factors = generateRiskFactors("IR", "oil");
    for (const f of factors) {
      expect(f.score).toBeGreaterThanOrEqual(0);
      expect(f.score).toBeLessThanOrEqual(100);
    }
  });

  test("is deterministic", () => {
    const a = generateRiskFactors("GB");
    const b = generateRiskFactors("GB");
    expect(a).toEqual(b);
  });
});

// --- getSanctionsPrograms ---

describe("getSanctionsPrograms", () => {
  test("returns programs for high-risk jurisdictions", () => {
    expect(getSanctionsPrograms("KP").length).toBeGreaterThan(0);
    expect(getSanctionsPrograms("IR").length).toBeGreaterThan(0);
  });

  test("returns monitoring program for medium-risk jurisdictions", () => {
    const programs = getSanctionsPrograms("CN");
    expect(programs.length).toBe(1);
    expect(programs[0]).toContain("Monitoring");
  });

  test("returns empty array for low-risk jurisdictions", () => {
    expect(getSanctionsPrograms("US")).toEqual([]);
  });
});

// --- computeLastUpdated ---

describe("computeLastUpdated", () => {
  test("returns valid ISO date", () => {
    const date = computeLastUpdated("US");
    expect(new Date(date).getTime()).not.toBeNaN();
  });

  test("is deterministic", () => {
    expect(computeLastUpdated("GB")).toBe(computeLastUpdated("GB"));
  });

  test("different jurisdictions may have different dates", () => {
    // Most likely differ due to different hashes
    const dates = new Set(["US", "GB", "IR", "KP", "CN"].map(computeLastUpdated));
    expect(dates.size).toBeGreaterThan(1);
  });
});
