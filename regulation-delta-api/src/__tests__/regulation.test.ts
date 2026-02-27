import { describe, test, expect } from "bun:test";
import {
  computeFreshness,
  computeDeltas,
  computeImpacts,
  computeControlMapping,
  seedFromInput,
} from "../regulation";
import type { DeltaEntry, ImpactEntry, MappedControl } from "../schemas";
import { deltaEntrySchema, impactEntrySchema, mappedControlSchema, deltaOutputSchema, impactOutputSchema, mapControlsOutputSchema } from "../schemas";

// --- Freshness ---

describe("computeFreshness", () => {
  test("returns zero ageSeconds when fetchedAt equals now", () => {
    const now = new Date("2025-01-15T10:00:00.000Z");
    const result = computeFreshness(now, now);
    expect(result.ageSeconds).toBe(0);
    expect(result.stale).toBe(false);
  });

  test("returns correct ageSeconds for past fetchedAt", () => {
    const fetchedAt = new Date("2025-01-15T10:00:00.000Z");
    const now = new Date("2025-01-15T10:01:00.000Z");
    const result = computeFreshness(fetchedAt, now);
    expect(result.ageSeconds).toBe(60);
  });

  test("marks as stale when ageSeconds exceeds threshold", () => {
    const fetchedAt = new Date("2025-01-15T10:00:00.000Z");
    const now = new Date("2025-01-15T10:10:00.000Z"); // 600 seconds
    const result = computeFreshness(fetchedAt, now, 300);
    expect(result.stale).toBe(true);
  });

  test("marks as not stale when within threshold", () => {
    const fetchedAt = new Date("2025-01-15T10:00:00.000Z");
    const now = new Date("2025-01-15T10:02:00.000Z"); // 120 seconds
    const result = computeFreshness(fetchedAt, now, 300);
    expect(result.stale).toBe(false);
  });

  test("timestamp is valid ISO datetime", () => {
    const now = new Date("2025-01-15T10:00:00.000Z");
    const result = computeFreshness(now, now);
    expect(() => new Date(result.timestamp)).not.toThrow();
    expect(result.timestamp).toContain("T");
  });

  test("never returns negative ageSeconds", () => {
    const fetchedAt = new Date("2025-01-15T10:05:00.000Z");
    const now = new Date("2025-01-15T10:00:00.000Z"); // future fetchedAt
    const result = computeFreshness(fetchedAt, now);
    expect(result.ageSeconds).toBeGreaterThanOrEqual(0);
  });
});

// --- Seed determinism ---

describe("seedFromInput", () => {
  test("same inputs produce same seed", () => {
    const seed1 = seedFromInput("US", "finance");
    const seed2 = seedFromInput("US", "finance");
    expect(seed1).toBe(seed2);
  });

  test("different jurisdictions produce different seeds", () => {
    const seed1 = seedFromInput("US", "finance");
    const seed2 = seedFromInput("GB", "finance");
    expect(seed1).not.toBe(seed2);
  });

  test("different industries produce different seeds", () => {
    const seed1 = seedFromInput("US", "finance");
    const seed2 = seedFromInput("US", "healthcare");
    expect(seed1).not.toBe(seed2);
  });

  test("seed is a positive number", () => {
    const seed = seedFromInput("US", "finance");
    expect(seed).toBeGreaterThan(0);
  });

  test("no industry vs with industry produce different seeds", () => {
    const seed1 = seedFromInput("US");
    const seed2 = seedFromInput("US", "finance");
    expect(seed1).not.toBe(seed2);
  });
});

// --- Compute Deltas ---

describe("computeDeltas", () => {
  test("returns array of delta entries for US", () => {
    const deltas = computeDeltas("US", "2025-01-01");
    expect(Array.isArray(deltas)).toBe(true);
    expect(deltas.length).toBeGreaterThan(0);
  });

  test("returns deterministic results for same inputs", () => {
    const deltas1 = computeDeltas("US", "2025-01-01");
    const deltas2 = computeDeltas("US", "2025-01-01");
    expect(deltas1).toEqual(deltas2);
  });

  test("returns different results for different jurisdictions", () => {
    const deltasUS = computeDeltas("US", "2025-01-01");
    const deltasGB = computeDeltas("GB", "2025-01-01");
    expect(deltasUS[0].ruleId).not.toBe(deltasGB[0].ruleId);
  });

  test("each delta entry validates against schema", () => {
    const deltas = computeDeltas("US", "2025-01-01");
    for (const delta of deltas) {
      const result = deltaEntrySchema.safeParse(delta);
      expect(result.success).toBe(true);
    }
  });

  test("urgency_score is between 0 and 100 for all deltas", () => {
    const deltas = computeDeltas("US", "2025-01-01");
    for (const delta of deltas) {
      expect(delta.urgency_score).toBeGreaterThanOrEqual(0);
      expect(delta.urgency_score).toBeLessThanOrEqual(100);
    }
  });

  test("effective_date is valid ISO date for all deltas", () => {
    const deltas = computeDeltas("US", "2025-01-01");
    for (const delta of deltas) {
      expect(delta.effective_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test("published_date is valid ISO date for all deltas", () => {
    const deltas = computeDeltas("US", "2025-01-01");
    for (const delta of deltas) {
      expect(delta.published_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test("source_url is valid URL for all deltas", () => {
    const deltas = computeDeltas("US", "2025-01-01");
    for (const delta of deltas) {
      expect(() => new URL(delta.source_url)).not.toThrow();
    }
  });

  test("industry filter changes results", () => {
    const deltasAll = computeDeltas("US", "2025-01-01");
    const deltasFinance = computeDeltas("US", "2025-01-01", "finance");
    // Different because industry seeds differently
    expect(deltasAll).not.toEqual(deltasFinance);
  });

  test("source_priority official returns fewer or equal results", () => {
    const deltasAll = computeDeltas("US", "2025-01-01", undefined, "all");
    const deltasOfficial = computeDeltas("US", "2025-01-01", undefined, "official");
    expect(deltasOfficial.length).toBeLessThanOrEqual(deltasAll.length);
  });

  test("ruleId includes jurisdiction prefix", () => {
    const deltas = computeDeltas("US", "2025-01-01");
    for (const delta of deltas) {
      expect(delta.ruleId.startsWith("US-")).toBe(true);
    }
  });

  test("returns deltas for DE jurisdiction", () => {
    const deltas = computeDeltas("DE", "2025-01-01");
    expect(deltas.length).toBeGreaterThan(0);
    for (const delta of deltas) {
      expect(delta.ruleId.startsWith("DE-")).toBe(true);
    }
  });

  test("semantic_change_type is a valid enum value", () => {
    const validTypes = ["new_rule", "amendment", "repeal", "guidance_update", "enforcement_action"];
    const deltas = computeDeltas("US", "2025-01-01");
    for (const delta of deltas) {
      expect(validTypes).toContain(delta.semantic_change_type);
    }
  });
});

// --- Compute Impacts ---

describe("computeImpacts", () => {
  test("returns array of impact entries for US", () => {
    const impacts = computeImpacts("US");
    expect(Array.isArray(impacts)).toBe(true);
    expect(impacts.length).toBeGreaterThan(0);
  });

  test("returns deterministic results for same inputs", () => {
    const impacts1 = computeImpacts("US");
    const impacts2 = computeImpacts("US");
    expect(impacts1).toEqual(impacts2);
  });

  test("each impact entry validates against schema", () => {
    const impacts = computeImpacts("US");
    for (const impact of impacts) {
      const result = impactEntrySchema.safeParse(impact);
      expect(result.success).toBe(true);
    }
  });

  test("affected_controls is non-empty for each impact", () => {
    const impacts = computeImpacts("US");
    for (const impact of impacts) {
      expect(impact.affected_controls.length).toBeGreaterThan(0);
    }
  });

  test("filtering by ruleId returns single result", () => {
    const allImpacts = computeImpacts("US");
    const firstRuleId = allImpacts[0].ruleId;
    const filtered = computeImpacts("US", undefined, firstRuleId);
    expect(filtered.length).toBe(1);
    expect(filtered[0].ruleId).toBe(firstRuleId);
  });

  test("filtering by nonexistent ruleId returns empty", () => {
    const filtered = computeImpacts("US", undefined, "NONEXISTENT-RULE-999");
    expect(filtered.length).toBe(0);
  });

  test("different jurisdictions produce different impacts", () => {
    const impactsUS = computeImpacts("US");
    const impactsGB = computeImpacts("GB");
    expect(impactsUS[0].ruleId).not.toBe(impactsGB[0].ruleId);
  });

  test("industry filter changes results", () => {
    const impactsAll = computeImpacts("US");
    const impactsFinance = computeImpacts("US", "finance");
    expect(impactsAll).not.toEqual(impactsFinance);
  });

  test("impact_level is a valid enum value", () => {
    const validLevels = ["low", "medium", "high", "critical"];
    const impacts = computeImpacts("US");
    for (const impact of impacts) {
      expect(validLevels).toContain(impact.impact_level);
    }
  });

  test("remediation_urgency is a valid enum value", () => {
    const validUrgencies = ["immediate", "short_term", "planned"];
    const impacts = computeImpacts("US");
    for (const impact of impacts) {
      expect(validUrgencies).toContain(impact.remediation_urgency);
    }
  });

  test("estimated_effort is a valid enum value", () => {
    const validEfforts = ["minimal", "moderate", "significant", "major"];
    const impacts = computeImpacts("US");
    for (const impact of impacts) {
      expect(validEfforts).toContain(impact.estimated_effort);
    }
  });
});

// --- Compute Control Mapping ---

describe("computeControlMapping", () => {
  test("returns mapped controls for soc2 framework", () => {
    const result = computeControlMapping("US-REG-001", "soc2", "US");
    expect(result.mapped_controls.length).toBeGreaterThan(0);
  });

  test("returns deterministic results", () => {
    const result1 = computeControlMapping("US-REG-001", "soc2", "US");
    const result2 = computeControlMapping("US-REG-001", "soc2", "US");
    expect(result1).toEqual(result2);
  });

  test("each mapped control validates against schema", () => {
    const result = computeControlMapping("US-REG-001", "soc2", "US");
    for (const mc of result.mapped_controls) {
      const parsed = mappedControlSchema.safeParse(mc);
      expect(parsed.success).toBe(true);
    }
  });

  test("mapping_confidence is between 0 and 1", () => {
    const result = computeControlMapping("US-REG-001", "soc2", "US");
    for (const mc of result.mapped_controls) {
      expect(mc.mapping_confidence).toBeGreaterThanOrEqual(0);
      expect(mc.mapping_confidence).toBeLessThanOrEqual(1);
    }
  });

  test("coverage_score is between 0 and 1", () => {
    const result = computeControlMapping("US-REG-001", "soc2", "US");
    expect(result.coverage_score).toBeGreaterThanOrEqual(0);
    expect(result.coverage_score).toBeLessThanOrEqual(1);
  });

  test("total_mapped matches mapped_controls length", () => {
    const result = computeControlMapping("US-REG-001", "soc2", "US");
    expect(result.total_mapped).toBe(result.mapped_controls.length);
  });

  test("different frameworks produce different controls", () => {
    const soc2 = computeControlMapping("US-REG-001", "soc2", "US");
    const nist = computeControlMapping("US-REG-001", "nist", "US");
    expect(soc2.mapped_controls[0].controlId).not.toBe(nist.mapped_controls[0].controlId);
  });

  test("iso27001 framework returns valid controls", () => {
    const result = computeControlMapping("US-REG-001", "iso27001", "US");
    expect(result.mapped_controls.length).toBeGreaterThan(0);
    for (const mc of result.mapped_controls) {
      expect(mc.controlId).toBeTruthy();
      expect(mc.controlName).toBeTruthy();
    }
  });

  test("gdpr framework returns valid controls", () => {
    const result = computeControlMapping("US-REG-001", "gdpr", "US");
    expect(result.mapped_controls.length).toBeGreaterThan(0);
  });

  test("gap_status is a valid enum value", () => {
    const validStatuses = ["compliant", "partial_gap", "full_gap", "not_assessed"];
    const result = computeControlMapping("US-REG-001", "soc2", "US");
    for (const mc of result.mapped_controls) {
      expect(validStatuses).toContain(mc.gap_status);
    }
  });

  test("remediation_steps is an array for each control", () => {
    const result = computeControlMapping("US-REG-001", "soc2", "US");
    for (const mc of result.mapped_controls) {
      expect(Array.isArray(mc.remediation_steps)).toBe(true);
    }
  });
});
