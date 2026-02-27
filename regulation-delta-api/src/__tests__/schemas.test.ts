import { describe, test, expect } from "bun:test";
import {
  freshnessSchema,
  jurisdictionSchema,
  isoDateSchema,
  semanticChangeTypeSchema,
  sourcePrioritySchema,
  controlFrameworkSchema,
  controlFrameworkStrictSchema,
  impactLevelSchema,
  remediationUrgencySchema,
  estimatedEffortSchema,
  gapStatusSchema,
  deltaInputSchema,
  deltaEntrySchema,
  deltaOutputSchema,
  impactInputSchema,
  impactEntrySchema,
  impactOutputSchema,
  mapControlsInputSchema,
  mappedControlSchema,
  mapControlsOutputSchema,
  errorSchema,
} from "../schemas";

// --- Freshness Schema ---

describe("freshnessSchema", () => {
  test("accepts valid freshness object", () => {
    const result = freshnessSchema.safeParse({
      timestamp: "2025-01-15T10:00:00.000Z",
      ageSeconds: 30,
      stale: false,
    });
    expect(result.success).toBe(true);
  });

  test("rejects non-datetime timestamp", () => {
    const result = freshnessSchema.safeParse({
      timestamp: "not-a-date",
      ageSeconds: 30,
      stale: false,
    });
    expect(result.success).toBe(false);
  });

  test("rejects negative ageSeconds", () => {
    const result = freshnessSchema.safeParse({
      timestamp: "2025-01-15T10:00:00.000Z",
      ageSeconds: -1,
      stale: false,
    });
    expect(result.success).toBe(false);
  });

  test("rejects missing stale field", () => {
    const result = freshnessSchema.safeParse({
      timestamp: "2025-01-15T10:00:00.000Z",
      ageSeconds: 0,
    });
    expect(result.success).toBe(false);
  });
});

// --- Jurisdiction Schema ---

describe("jurisdictionSchema", () => {
  test("accepts valid ISO-3166 code US", () => {
    expect(jurisdictionSchema.safeParse("US").success).toBe(true);
  });

  test("accepts valid ISO-3166 code GB", () => {
    expect(jurisdictionSchema.safeParse("GB").success).toBe(true);
  });

  test("accepts valid 3-letter code USA", () => {
    expect(jurisdictionSchema.safeParse("USA").success).toBe(true);
  });

  test("rejects lowercase code", () => {
    expect(jurisdictionSchema.safeParse("us").success).toBe(false);
  });

  test("rejects single character", () => {
    expect(jurisdictionSchema.safeParse("U").success).toBe(false);
  });

  test("rejects 4+ character code", () => {
    expect(jurisdictionSchema.safeParse("USAA").success).toBe(false);
  });

  test("rejects numeric code", () => {
    expect(jurisdictionSchema.safeParse("12").success).toBe(false);
  });
});

// --- ISO Date Schema ---

describe("isoDateSchema", () => {
  test("accepts valid ISO date", () => {
    expect(isoDateSchema.safeParse("2025-01-15").success).toBe(true);
  });

  test("rejects datetime format", () => {
    expect(isoDateSchema.safeParse("2025-01-15T10:00:00Z").success).toBe(false);
  });

  test("rejects invalid date format", () => {
    expect(isoDateSchema.safeParse("01-15-2025").success).toBe(false);
  });

  test("rejects empty string", () => {
    expect(isoDateSchema.safeParse("").success).toBe(false);
  });
});

// --- Enum Schemas ---

describe("semanticChangeTypeSchema", () => {
  test("accepts new_rule", () => {
    expect(semanticChangeTypeSchema.safeParse("new_rule").success).toBe(true);
  });

  test("accepts amendment", () => {
    expect(semanticChangeTypeSchema.safeParse("amendment").success).toBe(true);
  });

  test("accepts repeal", () => {
    expect(semanticChangeTypeSchema.safeParse("repeal").success).toBe(true);
  });

  test("accepts guidance_update", () => {
    expect(semanticChangeTypeSchema.safeParse("guidance_update").success).toBe(true);
  });

  test("accepts enforcement_action", () => {
    expect(semanticChangeTypeSchema.safeParse("enforcement_action").success).toBe(true);
  });

  test("rejects invalid type", () => {
    expect(semanticChangeTypeSchema.safeParse("unknown").success).toBe(false);
  });
});

describe("sourcePrioritySchema", () => {
  test("accepts official", () => {
    expect(sourcePrioritySchema.safeParse("official").success).toBe(true);
  });

  test("accepts all", () => {
    expect(sourcePrioritySchema.safeParse("all").success).toBe(true);
  });

  test("defaults to all when undefined", () => {
    const result = sourcePrioritySchema.safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("all");
  });

  test("rejects invalid priority", () => {
    expect(sourcePrioritySchema.safeParse("high").success).toBe(false);
  });
});

describe("controlFrameworkSchema", () => {
  test("accepts soc2", () => {
    expect(controlFrameworkSchema.safeParse("soc2").success).toBe(true);
  });

  test("accepts iso27001", () => {
    expect(controlFrameworkSchema.safeParse("iso27001").success).toBe(true);
  });

  test("accepts nist", () => {
    expect(controlFrameworkSchema.safeParse("nist").success).toBe(true);
  });

  test("accepts gdpr", () => {
    expect(controlFrameworkSchema.safeParse("gdpr").success).toBe(true);
  });

  test("accepts all", () => {
    expect(controlFrameworkSchema.safeParse("all").success).toBe(true);
  });

  test("rejects unknown framework", () => {
    expect(controlFrameworkSchema.safeParse("hipaa").success).toBe(false);
  });
});

describe("controlFrameworkStrictSchema", () => {
  test("rejects all (not allowed in strict)", () => {
    expect(controlFrameworkStrictSchema.safeParse("all").success).toBe(false);
  });

  test("accepts soc2 in strict", () => {
    expect(controlFrameworkStrictSchema.safeParse("soc2").success).toBe(true);
  });
});

describe("impactLevelSchema", () => {
  test("accepts all valid levels", () => {
    for (const level of ["low", "medium", "high", "critical"]) {
      expect(impactLevelSchema.safeParse(level).success).toBe(true);
    }
  });

  test("rejects invalid level", () => {
    expect(impactLevelSchema.safeParse("extreme").success).toBe(false);
  });
});

describe("remediationUrgencySchema", () => {
  test("accepts all valid urgency values", () => {
    for (const u of ["immediate", "short_term", "planned"]) {
      expect(remediationUrgencySchema.safeParse(u).success).toBe(true);
    }
  });

  test("rejects invalid urgency", () => {
    expect(remediationUrgencySchema.safeParse("urgent").success).toBe(false);
  });
});

describe("estimatedEffortSchema", () => {
  test("accepts all valid effort values", () => {
    for (const e of ["minimal", "moderate", "significant", "major"]) {
      expect(estimatedEffortSchema.safeParse(e).success).toBe(true);
    }
  });

  test("rejects invalid effort", () => {
    expect(estimatedEffortSchema.safeParse("huge").success).toBe(false);
  });
});

describe("gapStatusSchema", () => {
  test("accepts all valid gap statuses", () => {
    for (const g of ["compliant", "partial_gap", "full_gap", "not_assessed"]) {
      expect(gapStatusSchema.safeParse(g).success).toBe(true);
    }
  });

  test("rejects invalid gap status", () => {
    expect(gapStatusSchema.safeParse("unknown").success).toBe(false);
  });
});

// --- Delta Input Schema ---

describe("deltaInputSchema", () => {
  test("accepts valid input with all fields", () => {
    const result = deltaInputSchema.safeParse({
      jurisdiction: "US",
      industry: "finance",
      since: "2025-01-01",
      source_priority: "official",
    });
    expect(result.success).toBe(true);
  });

  test("accepts input without optional industry", () => {
    const result = deltaInputSchema.safeParse({
      jurisdiction: "US",
      since: "2025-01-01",
    });
    expect(result.success).toBe(true);
  });

  test("defaults source_priority to all", () => {
    const result = deltaInputSchema.safeParse({
      jurisdiction: "US",
      since: "2025-01-01",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.source_priority).toBe("all");
  });

  test("rejects missing jurisdiction", () => {
    const result = deltaInputSchema.safeParse({
      since: "2025-01-01",
    });
    expect(result.success).toBe(false);
  });

  test("rejects missing since", () => {
    const result = deltaInputSchema.safeParse({
      jurisdiction: "US",
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid since date format", () => {
    const result = deltaInputSchema.safeParse({
      jurisdiction: "US",
      since: "Jan 1 2025",
    });
    expect(result.success).toBe(false);
  });
});

// --- Delta Entry Schema ---

describe("deltaEntrySchema", () => {
  const validEntry = {
    ruleId: "US-SEC-2025-001",
    title: "New SEC Disclosure Rule",
    semantic_change_type: "new_rule",
    summary: "Requires enhanced climate risk disclosure",
    effective_date: "2025-06-01",
    published_date: "2025-01-15",
    source_url: "https://sec.gov/rules/2025-001",
    urgency_score: 85,
  };

  test("accepts valid delta entry", () => {
    expect(deltaEntrySchema.safeParse(validEntry).success).toBe(true);
  });

  test("rejects urgency_score above 100", () => {
    expect(deltaEntrySchema.safeParse({ ...validEntry, urgency_score: 101 }).success).toBe(false);
  });

  test("rejects urgency_score below 0", () => {
    expect(deltaEntrySchema.safeParse({ ...validEntry, urgency_score: -1 }).success).toBe(false);
  });

  test("rejects invalid source_url", () => {
    expect(deltaEntrySchema.safeParse({ ...validEntry, source_url: "not-a-url" }).success).toBe(false);
  });

  test("rejects empty ruleId", () => {
    expect(deltaEntrySchema.safeParse({ ...validEntry, ruleId: "" }).success).toBe(false);
  });

  test("rejects empty title", () => {
    expect(deltaEntrySchema.safeParse({ ...validEntry, title: "" }).success).toBe(false);
  });
});

// --- Delta Output Schema ---

describe("deltaOutputSchema", () => {
  test("accepts valid output with deltas", () => {
    const output = {
      jurisdiction: "US",
      deltas: [{
        ruleId: "US-SEC-2025-001",
        title: "New Rule",
        semantic_change_type: "new_rule",
        summary: "A new rule",
        effective_date: "2025-06-01",
        published_date: "2025-01-15",
        source_url: "https://sec.gov/rules/2025-001",
        urgency_score: 85,
      }],
      total_changes: 1,
      freshness: {
        timestamp: "2025-01-15T10:00:00.000Z",
        ageSeconds: 0,
        stale: false,
      },
    };
    expect(deltaOutputSchema.safeParse(output).success).toBe(true);
  });

  test("accepts empty deltas array", () => {
    const output = {
      jurisdiction: "US",
      deltas: [],
      total_changes: 0,
      freshness: {
        timestamp: "2025-01-15T10:00:00.000Z",
        ageSeconds: 0,
        stale: false,
      },
    };
    expect(deltaOutputSchema.safeParse(output).success).toBe(true);
  });
});

// --- Impact Input Schema ---

describe("impactInputSchema", () => {
  test("accepts valid impact input", () => {
    const result = impactInputSchema.safeParse({
      jurisdiction: "US",
      industry: "finance",
      ruleId: "US-SEC-2025-001",
      control_framework: "soc2",
    });
    expect(result.success).toBe(true);
  });

  test("defaults control_framework to all", () => {
    const result = impactInputSchema.safeParse({ jurisdiction: "US" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.control_framework).toBe("all");
  });

  test("rejects missing jurisdiction", () => {
    expect(impactInputSchema.safeParse({}).success).toBe(false);
  });
});

// --- Impact Entry Schema ---

describe("impactEntrySchema", () => {
  const validImpact = {
    ruleId: "US-SEC-2025-001",
    title: "Impact of New Rule",
    affected_controls: ["SOC2-CC6.1", "SOC2-CC6.2"],
    impact_level: "high",
    remediation_urgency: "immediate",
    estimated_effort: "significant",
    description: "Requires updating data handling controls",
  };

  test("accepts valid impact entry", () => {
    expect(impactEntrySchema.safeParse(validImpact).success).toBe(true);
  });

  test("accepts empty affected_controls array", () => {
    expect(impactEntrySchema.safeParse({ ...validImpact, affected_controls: [] }).success).toBe(true);
  });

  test("rejects empty description", () => {
    expect(impactEntrySchema.safeParse({ ...validImpact, description: "" }).success).toBe(false);
  });
});

// --- Impact Output Schema ---

describe("impactOutputSchema", () => {
  test("accepts valid impact output", () => {
    const output = {
      jurisdiction: "US",
      impacts: [{
        ruleId: "US-SEC-2025-001",
        title: "Impact",
        affected_controls: ["SOC2-CC6.1"],
        impact_level: "high",
        remediation_urgency: "immediate",
        estimated_effort: "significant",
        description: "Impact description",
      }],
      total_impacts: 1,
      freshness: { timestamp: "2025-01-15T10:00:00.000Z", ageSeconds: 0, stale: false },
    };
    expect(impactOutputSchema.safeParse(output).success).toBe(true);
  });
});

// --- Map Controls Input Schema ---

describe("mapControlsInputSchema", () => {
  test("accepts valid map-controls input", () => {
    const result = mapControlsInputSchema.safeParse({
      ruleId: "US-SEC-2025-001",
      control_framework: "soc2",
      jurisdiction: "US",
    });
    expect(result.success).toBe(true);
  });

  test("rejects missing ruleId", () => {
    expect(mapControlsInputSchema.safeParse({ control_framework: "soc2", jurisdiction: "US" }).success).toBe(false);
  });

  test("rejects missing control_framework", () => {
    expect(mapControlsInputSchema.safeParse({ ruleId: "X", jurisdiction: "US" }).success).toBe(false);
  });

  test("rejects all as control_framework (strict only)", () => {
    expect(mapControlsInputSchema.safeParse({ ruleId: "X", control_framework: "all", jurisdiction: "US" }).success).toBe(false);
  });

  test("rejects missing jurisdiction", () => {
    expect(mapControlsInputSchema.safeParse({ ruleId: "X", control_framework: "soc2" }).success).toBe(false);
  });
});

// --- Mapped Control Schema ---

describe("mappedControlSchema", () => {
  const validMapped = {
    controlId: "SOC2-CC6.1",
    controlName: "Logical Access Controls",
    mapping_confidence: 0.85,
    gap_status: "partial_gap",
    remediation_steps: ["Update access policies", "Implement MFA"],
  };

  test("accepts valid mapped control", () => {
    expect(mappedControlSchema.safeParse(validMapped).success).toBe(true);
  });

  test("rejects mapping_confidence above 1", () => {
    expect(mappedControlSchema.safeParse({ ...validMapped, mapping_confidence: 1.1 }).success).toBe(false);
  });

  test("rejects mapping_confidence below 0", () => {
    expect(mappedControlSchema.safeParse({ ...validMapped, mapping_confidence: -0.1 }).success).toBe(false);
  });

  test("accepts empty remediation_steps", () => {
    expect(mappedControlSchema.safeParse({ ...validMapped, remediation_steps: [] }).success).toBe(true);
  });
});

// --- Map Controls Output Schema ---

describe("mapControlsOutputSchema", () => {
  test("accepts valid map-controls output", () => {
    const output = {
      ruleId: "US-SEC-2025-001",
      control_framework: "soc2",
      jurisdiction: "US",
      mapped_controls: [{
        controlId: "SOC2-CC6.1",
        controlName: "Logical Access Controls",
        mapping_confidence: 0.85,
        gap_status: "partial_gap",
        remediation_steps: ["Update access policies"],
      }],
      total_mapped: 1,
      coverage_score: 0.75,
      freshness: { timestamp: "2025-01-15T10:00:00.000Z", ageSeconds: 0, stale: false },
    };
    expect(mapControlsOutputSchema.safeParse(output).success).toBe(true);
  });

  test("rejects coverage_score above 1", () => {
    const output = {
      ruleId: "X",
      control_framework: "soc2",
      jurisdiction: "US",
      mapped_controls: [],
      total_mapped: 0,
      coverage_score: 1.5,
      freshness: { timestamp: "2025-01-15T10:00:00.000Z", ageSeconds: 0, stale: false },
    };
    expect(mapControlsOutputSchema.safeParse(output).success).toBe(false);
  });
});

// --- Error Schema ---

describe("errorSchema", () => {
  test("accepts valid error envelope", () => {
    const result = errorSchema.safeParse({
      error: { code: "VALIDATION_ERROR", message: "Invalid input" },
    });
    expect(result.success).toBe(true);
  });

  test("rejects missing code", () => {
    const result = errorSchema.safeParse({
      error: { message: "fail" },
    });
    expect(result.success).toBe(false);
  });

  test("rejects missing message", () => {
    const result = errorSchema.safeParse({
      error: { code: "ERR" },
    });
    expect(result.success).toBe(false);
  });
});
