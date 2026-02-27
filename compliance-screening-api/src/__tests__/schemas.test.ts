import { describe, test, expect } from "bun:test";
import {
  addressSchema,
  freshnessSchema,
  identifierSchema,
  screeningCheckInputSchema,
  matchSchema,
  evidenceBundleItemSchema,
  screeningCheckOutputSchema,
  exposureChainInputSchema,
  chainEntitySchema,
  exposureChainOutputSchema,
  jurisdictionRiskInputSchema,
  riskFactorSchema,
  jurisdictionRiskOutputSchema,
  errorSchema,
} from "../schemas";

// --- addressSchema ---

describe("addressSchema", () => {
  test("accepts valid ethereum address", () => {
    const result = addressSchema.safeParse("0x1234567890abcdef1234567890abcdef12345678");
    expect(result.success).toBe(true);
  });

  test("accepts uppercase hex", () => {
    const result = addressSchema.safeParse("0xABCDEF1234567890ABCDEF1234567890ABCDEF12");
    expect(result.success).toBe(true);
  });

  test("rejects address without 0x prefix", () => {
    const result = addressSchema.safeParse("1234567890abcdef1234567890abcdef12345678");
    expect(result.success).toBe(false);
  });

  test("rejects address that is too short", () => {
    const result = addressSchema.safeParse("0x1234");
    expect(result.success).toBe(false);
  });

  test("rejects address that is too long", () => {
    const result = addressSchema.safeParse("0x1234567890abcdef1234567890abcdef1234567890");
    expect(result.success).toBe(false);
  });

  test("rejects non-hex characters", () => {
    const result = addressSchema.safeParse("0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG");
    expect(result.success).toBe(false);
  });

  test("rejects empty string", () => {
    const result = addressSchema.safeParse("");
    expect(result.success).toBe(false);
  });
});

// --- freshnessSchema ---

describe("freshnessSchema", () => {
  test("accepts valid freshness", () => {
    const result = freshnessSchema.safeParse({
      timestamp: "2025-01-01T00:00:00.000Z",
      ageSeconds: 0,
      stale: false,
    });
    expect(result.success).toBe(true);
  });

  test("rejects negative ageSeconds", () => {
    const result = freshnessSchema.safeParse({
      timestamp: "2025-01-01T00:00:00.000Z",
      ageSeconds: -1,
      stale: false,
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid timestamp", () => {
    const result = freshnessSchema.safeParse({
      timestamp: "not-a-date",
      ageSeconds: 0,
      stale: false,
    });
    expect(result.success).toBe(false);
  });

  test("rejects missing stale field", () => {
    const result = freshnessSchema.safeParse({
      timestamp: "2025-01-01T00:00:00.000Z",
      ageSeconds: 0,
    });
    expect(result.success).toBe(false);
  });
});

// --- identifierSchema ---

describe("identifierSchema", () => {
  test("accepts valid identifier", () => {
    const result = identifierSchema.safeParse({ type: "passport", value: "AB123456" });
    expect(result.success).toBe(true);
  });

  test("rejects empty type", () => {
    const result = identifierSchema.safeParse({ type: "", value: "AB123456" });
    expect(result.success).toBe(false);
  });

  test("rejects empty value", () => {
    const result = identifierSchema.safeParse({ type: "passport", value: "" });
    expect(result.success).toBe(false);
  });
});

// --- screeningCheckInputSchema ---

describe("screeningCheckInputSchema", () => {
  test("accepts valid input with required fields only", () => {
    const result = screeningCheckInputSchema.safeParse({
      entityName: "John Doe",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entityType).toBe("individual");
    }
  });

  test("accepts valid input with all fields", () => {
    const result = screeningCheckInputSchema.safeParse({
      entityName: "Acme Corp",
      entityType: "organization",
      identifiers: [{ type: "tax_id", value: "123-45-6789" }],
      addresses: ["0x1234567890abcdef1234567890abcdef12345678"],
      jurisdictions: ["US", "GB"],
    });
    expect(result.success).toBe(true);
  });

  test("defaults entityType to individual", () => {
    const result = screeningCheckInputSchema.safeParse({ entityName: "Test" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entityType).toBe("individual");
    }
  });

  test("rejects empty entityName", () => {
    const result = screeningCheckInputSchema.safeParse({ entityName: "" });
    expect(result.success).toBe(false);
  });

  test("rejects missing entityName", () => {
    const result = screeningCheckInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  test("rejects invalid entityType", () => {
    const result = screeningCheckInputSchema.safeParse({
      entityName: "Test",
      entityType: "government",
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid eth address in addresses", () => {
    const result = screeningCheckInputSchema.safeParse({
      entityName: "Test",
      addresses: ["not-an-address"],
    });
    expect(result.success).toBe(false);
  });

  test("accepts organization entityType", () => {
    const result = screeningCheckInputSchema.safeParse({
      entityName: "Test Corp",
      entityType: "organization",
    });
    expect(result.success).toBe(true);
  });
});

// --- matchSchema ---

describe("matchSchema", () => {
  test("accepts valid match", () => {
    const result = matchSchema.safeParse({
      listName: "OFAC SDN List",
      matchedName: "John Doe",
      matchScore: 0.95,
      listCategory: "sanctions",
      listedSince: "2020-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  test("rejects matchScore above 1", () => {
    const result = matchSchema.safeParse({
      listName: "OFAC",
      matchedName: "Test",
      matchScore: 1.5,
      listCategory: "sanctions",
      listedSince: "2020-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  test("rejects matchScore below 0", () => {
    const result = matchSchema.safeParse({
      listName: "OFAC",
      matchedName: "Test",
      matchScore: -0.1,
      listCategory: "sanctions",
      listedSince: "2020-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  test("accepts all list categories", () => {
    for (const cat of ["sanctions", "pep", "adverse_media", "watchlist"]) {
      const result = matchSchema.safeParse({
        listName: "Test",
        matchedName: "Test",
        matchScore: 0.5,
        listCategory: cat,
        listedSince: "2020-01-01T00:00:00.000Z",
      });
      expect(result.success).toBe(true);
    }
  });

  test("rejects invalid list category", () => {
    const result = matchSchema.safeParse({
      listName: "Test",
      matchedName: "Test",
      matchScore: 0.5,
      listCategory: "terrorism",
      listedSince: "2020-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});

// --- screeningCheckOutputSchema ---

describe("screeningCheckOutputSchema", () => {
  test("accepts valid clear output", () => {
    const result = screeningCheckOutputSchema.safeParse({
      entityName: "John Doe",
      screening_status: "clear",
      match_confidence: 1.0,
      matches: [],
      evidence_bundle: [],
      confidence: 0.5,
      freshness: {
        timestamp: "2025-01-01T00:00:00.000Z",
        ageSeconds: 0,
        stale: false,
      },
    });
    expect(result.success).toBe(true);
  });

  test("accepts all screening statuses", () => {
    for (const status of ["clear", "match", "potential_match", "inconclusive"]) {
      const result = screeningCheckOutputSchema.safeParse({
        entityName: "Test",
        screening_status: status,
        match_confidence: 0.5,
        matches: [],
        evidence_bundle: [],
        confidence: 0.5,
        freshness: {
          timestamp: "2025-01-01T00:00:00.000Z",
          ageSeconds: 0,
          stale: false,
        },
      });
      expect(result.success).toBe(true);
    }
  });

  test("rejects invalid screening status", () => {
    const result = screeningCheckOutputSchema.safeParse({
      entityName: "Test",
      screening_status: "unknown",
      match_confidence: 0.5,
      matches: [],
      evidence_bundle: [],
      confidence: 0.5,
      freshness: {
        timestamp: "2025-01-01T00:00:00.000Z",
        ageSeconds: 0,
        stale: false,
      },
    });
    expect(result.success).toBe(false);
  });
});

// --- exposureChainInputSchema ---

describe("exposureChainInputSchema", () => {
  test("accepts valid input", () => {
    const result = exposureChainInputSchema.safeParse({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      ownershipDepth: "3",
    });
    expect(result.success).toBe(true);
  });

  test("defaults ownershipDepth to 2", () => {
    const result = exposureChainInputSchema.safeParse({
      address: "0x1234567890abcdef1234567890abcdef12345678",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ownershipDepth).toBe(2);
    }
  });

  test("rejects ownershipDepth below 1", () => {
    const result = exposureChainInputSchema.safeParse({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      ownershipDepth: "0",
    });
    expect(result.success).toBe(false);
  });

  test("rejects ownershipDepth above 5", () => {
    const result = exposureChainInputSchema.safeParse({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      ownershipDepth: "6",
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid address", () => {
    const result = exposureChainInputSchema.safeParse({
      address: "not-an-address",
    });
    expect(result.success).toBe(false);
  });
});

// --- chainEntitySchema ---

describe("chainEntitySchema", () => {
  test("accepts valid chain entity", () => {
    const result = chainEntitySchema.safeParse({
      entity: "0x1234567890abcdef1234567890abcdef12345678",
      relationship: "owner",
      riskLevel: "low",
      depth: 1,
    });
    expect(result.success).toBe(true);
  });

  test("accepts all relationship types", () => {
    for (const rel of ["owner", "controller", "beneficiary", "associate"]) {
      const result = chainEntitySchema.safeParse({
        entity: "test",
        relationship: rel,
        riskLevel: "low",
        depth: 1,
      });
      expect(result.success).toBe(true);
    }
  });

  test("accepts all risk levels", () => {
    for (const rl of ["low", "medium", "high", "critical"]) {
      const result = chainEntitySchema.safeParse({
        entity: "test",
        relationship: "owner",
        riskLevel: rl,
        depth: 1,
      });
      expect(result.success).toBe(true);
    }
  });

  test("rejects depth below 1", () => {
    const result = chainEntitySchema.safeParse({
      entity: "test",
      relationship: "owner",
      riskLevel: "low",
      depth: 0,
    });
    expect(result.success).toBe(false);
  });

  test("rejects depth above 5", () => {
    const result = chainEntitySchema.safeParse({
      entity: "test",
      relationship: "owner",
      riskLevel: "low",
      depth: 6,
    });
    expect(result.success).toBe(false);
  });
});

// --- jurisdictionRiskInputSchema ---

describe("jurisdictionRiskInputSchema", () => {
  test("accepts valid ISO-3166 code", () => {
    const result = jurisdictionRiskInputSchema.safeParse({ jurisdiction: "US" });
    expect(result.success).toBe(true);
  });

  test("accepts with industry", () => {
    const result = jurisdictionRiskInputSchema.safeParse({
      jurisdiction: "GB",
      industry: "finance",
    });
    expect(result.success).toBe(true);
  });

  test("rejects lowercase country code", () => {
    const result = jurisdictionRiskInputSchema.safeParse({ jurisdiction: "us" });
    expect(result.success).toBe(false);
  });

  test("rejects 3-letter code", () => {
    const result = jurisdictionRiskInputSchema.safeParse({ jurisdiction: "USA" });
    expect(result.success).toBe(false);
  });

  test("rejects empty jurisdiction", () => {
    const result = jurisdictionRiskInputSchema.safeParse({ jurisdiction: "" });
    expect(result.success).toBe(false);
  });

  test("rejects single letter", () => {
    const result = jurisdictionRiskInputSchema.safeParse({ jurisdiction: "U" });
    expect(result.success).toBe(false);
  });
});

// --- jurisdictionRiskOutputSchema ---

describe("jurisdictionRiskOutputSchema", () => {
  test("accepts valid output", () => {
    const result = jurisdictionRiskOutputSchema.safeParse({
      jurisdiction: "US",
      risk_score: 15,
      risk_level: "low",
      risk_factors: [{ factor: "AML", score: 20, description: "Good framework" }],
      sanctions_programs: [],
      last_updated: "2025-01-01T00:00:00.000Z",
      freshness: {
        timestamp: "2025-01-01T00:00:00.000Z",
        ageSeconds: 0,
        stale: false,
      },
    });
    expect(result.success).toBe(true);
  });

  test("rejects risk_score above 100", () => {
    const result = jurisdictionRiskOutputSchema.safeParse({
      jurisdiction: "US",
      risk_score: 101,
      risk_level: "low",
      risk_factors: [],
      sanctions_programs: [],
      last_updated: "2025-01-01T00:00:00.000Z",
      freshness: {
        timestamp: "2025-01-01T00:00:00.000Z",
        ageSeconds: 0,
        stale: false,
      },
    });
    expect(result.success).toBe(false);
  });

  test("rejects risk_score below 0", () => {
    const result = jurisdictionRiskOutputSchema.safeParse({
      jurisdiction: "US",
      risk_score: -1,
      risk_level: "low",
      risk_factors: [],
      sanctions_programs: [],
      last_updated: "2025-01-01T00:00:00.000Z",
      freshness: {
        timestamp: "2025-01-01T00:00:00.000Z",
        ageSeconds: 0,
        stale: false,
      },
    });
    expect(result.success).toBe(false);
  });
});

// --- errorSchema ---

describe("errorSchema", () => {
  test("accepts valid error", () => {
    const result = errorSchema.safeParse({
      error: { code: "VALIDATION_ERROR", message: "Bad input" },
    });
    expect(result.success).toBe(true);
  });

  test("rejects missing code", () => {
    const result = errorSchema.safeParse({
      error: { message: "Bad input" },
    });
    expect(result.success).toBe(false);
  });

  test("rejects missing message", () => {
    const result = errorSchema.safeParse({
      error: { code: "VALIDATION_ERROR" },
    });
    expect(result.success).toBe(false);
  });
});

// --- evidenceBundleItemSchema ---

describe("evidenceBundleItemSchema", () => {
  test("accepts valid evidence bundle item", () => {
    const result = evidenceBundleItemSchema.safeParse({
      source: "OFAC",
      reference: "REF-12345",
      retrievedAt: "2025-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  test("rejects invalid retrievedAt", () => {
    const result = evidenceBundleItemSchema.safeParse({
      source: "OFAC",
      reference: "REF-12345",
      retrievedAt: "not-a-date",
    });
    expect(result.success).toBe(false);
  });
});

// --- riskFactorSchema ---

describe("riskFactorSchema", () => {
  test("accepts valid risk factor", () => {
    const result = riskFactorSchema.safeParse({
      factor: "AML Framework",
      score: 45,
      description: "Test description",
    });
    expect(result.success).toBe(true);
  });

  test("rejects score above 100", () => {
    const result = riskFactorSchema.safeParse({
      factor: "AML Framework",
      score: 101,
      description: "Test",
    });
    expect(result.success).toBe(false);
  });

  test("rejects score below 0", () => {
    const result = riskFactorSchema.safeParse({
      factor: "AML Framework",
      score: -1,
      description: "Test",
    });
    expect(result.success).toBe(false);
  });
});
