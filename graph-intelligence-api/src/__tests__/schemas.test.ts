import { describe, it, expect } from "bun:test";
import {
  addressSchema,
  networkSchema,
  freshnessSchema,
  riskScoreInputSchema,
  riskScoreOutputSchema,
  riskFactorSchema,
  riskLevelSchema,
  exposurePathsInputSchema,
  exposurePathsOutputSchema,
  pathEdgeSchema,
  entityProfileInputSchema,
  entityProfileOutputSchema,
  entityTypeSchema,
  errorSchema,
} from "../schemas";

// --- Address Schema ---

describe("addressSchema", () => {
  it("accepts valid Ethereum address", () => {
    const result = addressSchema.safeParse("0x1234567890abcdef1234567890abcdef12345678");
    expect(result.success).toBe(true);
  });

  it("accepts uppercase hex address", () => {
    const result = addressSchema.safeParse("0xABCDEF1234567890ABCDEF1234567890ABCDEF12");
    expect(result.success).toBe(true);
  });

  it("rejects address without 0x prefix", () => {
    const result = addressSchema.safeParse("1234567890abcdef1234567890abcdef12345678");
    expect(result.success).toBe(false);
  });

  it("rejects address too short", () => {
    const result = addressSchema.safeParse("0x1234");
    expect(result.success).toBe(false);
  });

  it("rejects address too long", () => {
    const result = addressSchema.safeParse("0x1234567890abcdef1234567890abcdef1234567890");
    expect(result.success).toBe(false);
  });

  it("rejects non-hex characters", () => {
    const result = addressSchema.safeParse("0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG");
    expect(result.success).toBe(false);
  });

  it("rejects empty string", () => {
    const result = addressSchema.safeParse("");
    expect(result.success).toBe(false);
  });
});

// --- Network Schema ---

describe("networkSchema", () => {
  it("accepts 'ethereum'", () => {
    const result = networkSchema.safeParse("ethereum");
    expect(result.success).toBe(true);
    expect(result.data).toBe("ethereum");
  });

  it("accepts 'base'", () => {
    const result = networkSchema.safeParse("base");
    expect(result.success).toBe(true);
  });

  it("accepts 'polygon'", () => {
    const result = networkSchema.safeParse("polygon");
    expect(result.success).toBe(true);
  });

  it("defaults to 'base' when undefined", () => {
    const result = networkSchema.safeParse(undefined);
    expect(result.success).toBe(true);
    expect(result.data).toBe("base");
  });

  it("rejects invalid network", () => {
    const result = networkSchema.safeParse("solana");
    expect(result.success).toBe(false);
  });
});

// --- Freshness Schema ---

describe("freshnessSchema", () => {
  it("accepts valid freshness object", () => {
    const result = freshnessSchema.safeParse({
      timestamp: "2024-01-01T00:00:00.000Z",
      ageSeconds: 5,
      stale: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative ageSeconds", () => {
    const result = freshnessSchema.safeParse({
      timestamp: "2024-01-01T00:00:00.000Z",
      ageSeconds: -1,
      stale: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid timestamp", () => {
    const result = freshnessSchema.safeParse({
      timestamp: "not-a-date",
      ageSeconds: 0,
      stale: false,
    });
    expect(result.success).toBe(false);
  });
});

// --- Risk Score Input ---

describe("riskScoreInputSchema", () => {
  it("accepts valid input with all fields", () => {
    const result = riskScoreInputSchema.safeParse({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      network: "ethereum",
      transaction_context: "swap on uniswap",
      lookback_days: 90,
    });
    expect(result.success).toBe(true);
  });

  it("applies defaults for optional fields", () => {
    const result = riskScoreInputSchema.safeParse({
      address: "0x1234567890abcdef1234567890abcdef12345678",
    });
    expect(result.success).toBe(true);
    expect(result.data!.network).toBe("base");
    expect(result.data!.lookback_days).toBe(30);
    expect(result.data!.transaction_context).toBeUndefined();
  });

  it("rejects missing address", () => {
    const result = riskScoreInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects lookback_days below 1", () => {
    const result = riskScoreInputSchema.safeParse({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      lookback_days: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects lookback_days above 365", () => {
    const result = riskScoreInputSchema.safeParse({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      lookback_days: 400,
    });
    expect(result.success).toBe(false);
  });

  it("coerces string lookback_days to number", () => {
    const result = riskScoreInputSchema.safeParse({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      lookback_days: "60",
    });
    expect(result.success).toBe(true);
    expect(result.data!.lookback_days).toBe(60);
  });
});

// --- Risk Factor Schema ---

describe("riskFactorSchema", () => {
  it("accepts valid risk factor", () => {
    const result = riskFactorSchema.safeParse({
      factor: "mixer_interaction",
      score: 85,
      weight: 0.3,
      description: "Address has interacted with known mixer",
    });
    expect(result.success).toBe(true);
  });

  it("rejects score above 100", () => {
    const result = riskFactorSchema.safeParse({
      factor: "test",
      score: 101,
      weight: 0.5,
      description: "test",
    });
    expect(result.success).toBe(false);
  });

  it("rejects weight above 1", () => {
    const result = riskFactorSchema.safeParse({
      factor: "test",
      score: 50,
      weight: 1.5,
      description: "test",
    });
    expect(result.success).toBe(false);
  });
});

// --- Risk Level Schema ---

describe("riskLevelSchema", () => {
  it("accepts 'low'", () => {
    expect(riskLevelSchema.safeParse("low").success).toBe(true);
  });
  it("accepts 'medium'", () => {
    expect(riskLevelSchema.safeParse("medium").success).toBe(true);
  });
  it("accepts 'high'", () => {
    expect(riskLevelSchema.safeParse("high").success).toBe(true);
  });
  it("accepts 'critical'", () => {
    expect(riskLevelSchema.safeParse("critical").success).toBe(true);
  });
  it("rejects invalid level", () => {
    expect(riskLevelSchema.safeParse("extreme").success).toBe(false);
  });
});

// --- Risk Score Output ---

describe("riskScoreOutputSchema", () => {
  const validOutput = {
    address: "0x1234567890abcdef1234567890abcdef12345678",
    risk_score: 45,
    risk_level: "medium" as const,
    risk_factors: [
      { factor: "mixer_interaction", score: 80, weight: 0.3, description: "Mixer usage detected" },
    ],
    sanctions_proximity: 0.2,
    confidence: 0.85,
    freshness: {
      timestamp: "2024-01-01T00:00:00.000Z",
      ageSeconds: 0,
      stale: false,
    },
  };

  it("accepts valid output", () => {
    expect(riskScoreOutputSchema.safeParse(validOutput).success).toBe(true);
  });

  it("rejects risk_score above 100", () => {
    expect(riskScoreOutputSchema.safeParse({ ...validOutput, risk_score: 101 }).success).toBe(false);
  });

  it("rejects risk_score below 0", () => {
    expect(riskScoreOutputSchema.safeParse({ ...validOutput, risk_score: -1 }).success).toBe(false);
  });

  it("rejects sanctions_proximity above 1", () => {
    expect(riskScoreOutputSchema.safeParse({ ...validOutput, sanctions_proximity: 1.5 }).success).toBe(false);
  });

  it("rejects confidence above 1", () => {
    expect(riskScoreOutputSchema.safeParse({ ...validOutput, confidence: 1.1 }).success).toBe(false);
  });
});

// --- Exposure Paths Input ---

describe("exposurePathsInputSchema", () => {
  it("accepts valid input with defaults", () => {
    const result = exposurePathsInputSchema.safeParse({
      address: "0x1234567890abcdef1234567890abcdef12345678",
    });
    expect(result.success).toBe(true);
    expect(result.data!.threshold).toBe(50);
    expect(result.data!.maxHops).toBe(3);
    expect(result.data!.network).toBe("base");
  });

  it("accepts custom threshold and maxHops", () => {
    const result = exposurePathsInputSchema.safeParse({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      threshold: 75,
      maxHops: 5,
    });
    expect(result.success).toBe(true);
    expect(result.data!.threshold).toBe(75);
    expect(result.data!.maxHops).toBe(5);
  });

  it("rejects maxHops above 6", () => {
    const result = exposurePathsInputSchema.safeParse({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      maxHops: 7,
    });
    expect(result.success).toBe(false);
  });

  it("rejects maxHops below 1", () => {
    const result = exposurePathsInputSchema.safeParse({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      maxHops: 0,
    });
    expect(result.success).toBe(false);
  });

  it("coerces string threshold to number", () => {
    const result = exposurePathsInputSchema.safeParse({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      threshold: "80",
    });
    expect(result.success).toBe(true);
    expect(result.data!.threshold).toBe(80);
  });
});

// --- Path Edge Schema ---

describe("pathEdgeSchema", () => {
  it("accepts valid path edge", () => {
    const result = pathEdgeSchema.safeParse({
      from: "0xaaa",
      to: "0xbbb",
      relationship: "direct_transfer",
      risk_contribution: 45,
      hop: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects risk_contribution above 100", () => {
    const result = pathEdgeSchema.safeParse({
      from: "0xaaa",
      to: "0xbbb",
      relationship: "direct_transfer",
      risk_contribution: 150,
      hop: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects hop below 1", () => {
    const result = pathEdgeSchema.safeParse({
      from: "0xaaa",
      to: "0xbbb",
      relationship: "direct_transfer",
      risk_contribution: 50,
      hop: 0,
    });
    expect(result.success).toBe(false);
  });
});

// --- Exposure Paths Output ---

describe("exposurePathsOutputSchema", () => {
  it("accepts valid output with paths", () => {
    const result = exposurePathsOutputSchema.safeParse({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      paths: [
        { from: "0xaaa", to: "0xbbb", relationship: "direct_transfer", risk_contribution: 40, hop: 1 },
      ],
      total_exposure: 40,
      highest_risk_path_score: 40,
      freshness: { timestamp: "2024-01-01T00:00:00.000Z", ageSeconds: 0, stale: false },
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty paths array", () => {
    const result = exposurePathsOutputSchema.safeParse({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      paths: [],
      total_exposure: 0,
      highest_risk_path_score: 0,
      freshness: { timestamp: "2024-01-01T00:00:00.000Z", ageSeconds: 0, stale: false },
    });
    expect(result.success).toBe(true);
  });

  it("rejects total_exposure above 100", () => {
    const result = exposurePathsOutputSchema.safeParse({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      paths: [],
      total_exposure: 150,
      highest_risk_path_score: 0,
      freshness: { timestamp: "2024-01-01T00:00:00.000Z", ageSeconds: 0, stale: false },
    });
    expect(result.success).toBe(false);
  });
});

// --- Entity Profile Input ---

describe("entityProfileInputSchema", () => {
  it("accepts valid input with defaults", () => {
    const result = entityProfileInputSchema.safeParse({
      address: "0x1234567890abcdef1234567890abcdef12345678",
    });
    expect(result.success).toBe(true);
    expect(result.data!.network).toBe("base");
  });

  it("accepts explicit network", () => {
    const result = entityProfileInputSchema.safeParse({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      network: "polygon",
    });
    expect(result.success).toBe(true);
    expect(result.data!.network).toBe("polygon");
  });

  it("rejects missing address", () => {
    const result = entityProfileInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// --- Entity Type Schema ---

describe("entityTypeSchema", () => {
  const validTypes = ["individual", "exchange", "defi_protocol", "bridge", "mixer", "unknown"];

  for (const t of validTypes) {
    it(`accepts '${t}'`, () => {
      expect(entityTypeSchema.safeParse(t).success).toBe(true);
    });
  }

  it("rejects invalid entity type", () => {
    expect(entityTypeSchema.safeParse("whale").success).toBe(false);
  });
});

// --- Entity Profile Output ---

describe("entityProfileOutputSchema", () => {
  const validProfile = {
    address: "0x1234567890abcdef1234567890abcdef12345678",
    cluster_id: "cluster_abc123",
    entity_type: "exchange" as const,
    related_addresses: ["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
    transaction_volume_30d: "1500000.00",
    first_seen: "2023-06-15T10:30:00.000Z",
    last_active: "2024-01-01T12:00:00.000Z",
    tags: ["cex", "high_volume"],
    confidence: 0.9,
    freshness: { timestamp: "2024-01-01T00:00:00.000Z", ageSeconds: 0, stale: false },
  };

  it("accepts valid entity profile", () => {
    expect(entityProfileOutputSchema.safeParse(validProfile).success).toBe(true);
  });

  it("rejects confidence above 1", () => {
    expect(entityProfileOutputSchema.safeParse({ ...validProfile, confidence: 1.5 }).success).toBe(false);
  });

  it("accepts empty related_addresses", () => {
    expect(entityProfileOutputSchema.safeParse({ ...validProfile, related_addresses: [] }).success).toBe(true);
  });

  it("accepts empty tags", () => {
    expect(entityProfileOutputSchema.safeParse({ ...validProfile, tags: [] }).success).toBe(true);
  });
});

// --- Error Schema ---

describe("errorSchema", () => {
  it("accepts valid error envelope", () => {
    const result = errorSchema.safeParse({
      error: { code: "VALIDATION_ERROR", message: "Invalid input" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing code", () => {
    const result = errorSchema.safeParse({
      error: { message: "oops" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing message", () => {
    const result = errorSchema.safeParse({
      error: { code: "ERR" },
    });
    expect(result.success).toBe(false);
  });
});
