import { describe, it, expect } from "bun:test";
import {
  freshnessSchema,
  lineageInputSchema,
  lineageNodeSchema,
  lineageEdgeSchema,
  lineageOutputSchema,
  freshnessInputSchema,
  freshnessOutputSchema,
  verifyHashInputSchema,
  verifyHashOutputSchema,
  errorSchema,
} from "../schemas";

// ============================================================
// Freshness Schema
// ============================================================
describe("freshnessSchema", () => {
  it("accepts valid freshness object", () => {
    const result = freshnessSchema.safeParse({
      timestamp: "2025-01-01T00:00:00.000Z",
      ageSeconds: 10,
      stale: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid timestamp", () => {
    const result = freshnessSchema.safeParse({
      timestamp: "not-a-date",
      ageSeconds: 10,
      stale: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative ageSeconds", () => {
    const result = freshnessSchema.safeParse({
      timestamp: "2025-01-01T00:00:00.000Z",
      ageSeconds: -1,
      stale: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing stale field", () => {
    const result = freshnessSchema.safeParse({
      timestamp: "2025-01-01T00:00:00.000Z",
      ageSeconds: 10,
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// Lineage Input Schema
// ============================================================
describe("lineageInputSchema", () => {
  it("accepts valid input with defaults", () => {
    const result = lineageInputSchema.safeParse({ datasetId: "ds-123" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxDepth).toBe(3);
    }
  });

  it("accepts valid input with custom maxDepth", () => {
    const result = lineageInputSchema.safeParse({ datasetId: "ds-123", maxDepth: 7 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxDepth).toBe(7);
    }
  });

  it("rejects empty datasetId", () => {
    const result = lineageInputSchema.safeParse({ datasetId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing datasetId", () => {
    const result = lineageInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects maxDepth below 1", () => {
    const result = lineageInputSchema.safeParse({ datasetId: "ds-123", maxDepth: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects maxDepth above 10", () => {
    const result = lineageInputSchema.safeParse({ datasetId: "ds-123", maxDepth: 11 });
    expect(result.success).toBe(false);
  });

  it("coerces string maxDepth to number", () => {
    const result = lineageInputSchema.safeParse({ datasetId: "ds-123", maxDepth: "5" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxDepth).toBe(5);
    }
  });
});

// ============================================================
// Lineage Node Schema
// ============================================================
describe("lineageNodeSchema", () => {
  it("accepts valid node", () => {
    const result = lineageNodeSchema.safeParse({
      sourceId: "src-1",
      type: "api",
      updatedAt: "2025-01-01T00:00:00.000Z",
      dataPoints: 100,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative dataPoints", () => {
    const result = lineageNodeSchema.safeParse({
      sourceId: "src-1",
      type: "api",
      updatedAt: "2025-01-01T00:00:00.000Z",
      dataPoints: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer dataPoints", () => {
    const result = lineageNodeSchema.safeParse({
      sourceId: "src-1",
      type: "api",
      updatedAt: "2025-01-01T00:00:00.000Z",
      dataPoints: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing sourceId", () => {
    const result = lineageNodeSchema.safeParse({
      type: "api",
      updatedAt: "2025-01-01T00:00:00.000Z",
      dataPoints: 100,
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// Lineage Edge Schema
// ============================================================
describe("lineageEdgeSchema", () => {
  it("accepts valid edge", () => {
    const result = lineageEdgeSchema.safeParse({
      from: "src-1",
      to: "src-2",
      transformType: "aggregation",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing from", () => {
    const result = lineageEdgeSchema.safeParse({ to: "src-2", transformType: "agg" });
    expect(result.success).toBe(false);
  });

  it("rejects missing to", () => {
    const result = lineageEdgeSchema.safeParse({ from: "src-1", transformType: "agg" });
    expect(result.success).toBe(false);
  });

  it("rejects missing transformType", () => {
    const result = lineageEdgeSchema.safeParse({ from: "src-1", to: "src-2" });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// Lineage Output Schema
// ============================================================
describe("lineageOutputSchema", () => {
  const validFreshness = {
    timestamp: "2025-01-01T00:00:00.000Z",
    ageSeconds: 0,
    stale: false,
  };

  it("accepts valid full output", () => {
    const result = lineageOutputSchema.safeParse({
      datasetId: "ds-123",
      nodes: [
        { sourceId: "src-1", type: "api", updatedAt: "2025-01-01T00:00:00.000Z", dataPoints: 50 },
      ],
      edges: [{ from: "src-1", to: "ds-123", transformType: "ingest" }],
      freshness: validFreshness,
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty nodes and edges", () => {
    const result = lineageOutputSchema.safeParse({
      datasetId: "ds-123",
      nodes: [],
      edges: [],
      freshness: validFreshness,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing freshness", () => {
    const result = lineageOutputSchema.safeParse({
      datasetId: "ds-123",
      nodes: [],
      edges: [],
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// Freshness Input Schema
// ============================================================
describe("freshnessInputSchema", () => {
  it("accepts valid input with defaults", () => {
    const result = freshnessInputSchema.safeParse({ datasetId: "ds-123" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxStalenessMs).toBe(300000);
    }
  });

  it("accepts custom maxStalenessMs", () => {
    const result = freshnessInputSchema.safeParse({ datasetId: "ds-123", maxStalenessMs: 60000 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxStalenessMs).toBe(60000);
    }
  });

  it("rejects empty datasetId", () => {
    const result = freshnessInputSchema.safeParse({ datasetId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects negative maxStalenessMs", () => {
    const result = freshnessInputSchema.safeParse({ datasetId: "ds-123", maxStalenessMs: -1 });
    expect(result.success).toBe(false);
  });

  it("coerces string maxStalenessMs to number", () => {
    const result = freshnessInputSchema.safeParse({ datasetId: "ds-123", maxStalenessMs: "60000" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxStalenessMs).toBe(60000);
    }
  });
});

// ============================================================
// Freshness Output Schema
// ============================================================
describe("freshnessOutputSchema", () => {
  const validFreshness = {
    timestamp: "2025-01-01T00:00:00.000Z",
    ageSeconds: 0,
    stale: false,
  };

  it("accepts valid freshness output", () => {
    const result = freshnessOutputSchema.safeParse({
      datasetId: "ds-123",
      staleness_ms: 5000,
      sla_status: "fresh",
      lastUpdated: "2025-01-01T00:00:00.000Z",
      confidence: 0.95,
      freshness: validFreshness,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid sla_status", () => {
    const result = freshnessOutputSchema.safeParse({
      datasetId: "ds-123",
      staleness_ms: 5000,
      sla_status: "expired",
      lastUpdated: "2025-01-01T00:00:00.000Z",
      confidence: 0.95,
      freshness: validFreshness,
    });
    expect(result.success).toBe(false);
  });

  it("rejects confidence above 1", () => {
    const result = freshnessOutputSchema.safeParse({
      datasetId: "ds-123",
      staleness_ms: 5000,
      sla_status: "fresh",
      lastUpdated: "2025-01-01T00:00:00.000Z",
      confidence: 1.5,
      freshness: validFreshness,
    });
    expect(result.success).toBe(false);
  });

  it("rejects confidence below 0", () => {
    const result = freshnessOutputSchema.safeParse({
      datasetId: "ds-123",
      staleness_ms: 5000,
      sla_status: "fresh",
      lastUpdated: "2025-01-01T00:00:00.000Z",
      confidence: -0.1,
      freshness: validFreshness,
    });
    expect(result.success).toBe(false);
  });

  it("accepts all sla_status values", () => {
    for (const status of ["fresh", "stale", "unknown"] as const) {
      const result = freshnessOutputSchema.safeParse({
        datasetId: "ds-123",
        staleness_ms: 5000,
        sla_status: status,
        lastUpdated: "2025-01-01T00:00:00.000Z",
        confidence: 0.5,
        freshness: validFreshness,
      });
      expect(result.success).toBe(true);
    }
  });
});

// ============================================================
// Verify Hash Input Schema
// ============================================================
describe("verifyHashInputSchema", () => {
  it("accepts valid input with defaults", () => {
    const result = verifyHashInputSchema.safeParse({
      datasetId: "ds-123",
      expectedHash: "abc123def456",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.algorithm).toBe("sha256");
    }
  });

  it("accepts sha384 algorithm", () => {
    const result = verifyHashInputSchema.safeParse({
      datasetId: "ds-123",
      expectedHash: "abc123",
      algorithm: "sha384",
    });
    expect(result.success).toBe(true);
  });

  it("accepts sha512 algorithm", () => {
    const result = verifyHashInputSchema.safeParse({
      datasetId: "ds-123",
      expectedHash: "abc123",
      algorithm: "sha512",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-hex expectedHash", () => {
    const result = verifyHashInputSchema.safeParse({
      datasetId: "ds-123",
      expectedHash: "not-hex!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty expectedHash", () => {
    const result = verifyHashInputSchema.safeParse({
      datasetId: "ds-123",
      expectedHash: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid algorithm", () => {
    const result = verifyHashInputSchema.safeParse({
      datasetId: "ds-123",
      expectedHash: "abc123",
      algorithm: "md5",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing datasetId", () => {
    const result = verifyHashInputSchema.safeParse({
      expectedHash: "abc123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing expectedHash", () => {
    const result = verifyHashInputSchema.safeParse({
      datasetId: "ds-123",
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// Verify Hash Output Schema
// ============================================================
describe("verifyHashOutputSchema", () => {
  const validFreshness = {
    timestamp: "2025-01-01T00:00:00.000Z",
    ageSeconds: 0,
    stale: false,
  };

  it("accepts valid verified output", () => {
    const result = verifyHashOutputSchema.safeParse({
      datasetId: "ds-123",
      verified: true,
      computedHash: "abc123",
      algorithm: "sha256",
      matchDetails: {
        expectedHash: "abc123",
        match: true,
        bytesVerified: 1024,
      },
      attestation_ref: "att-ref-001",
      freshness: validFreshness,
    });
    expect(result.success).toBe(true);
  });

  it("accepts unverified output", () => {
    const result = verifyHashOutputSchema.safeParse({
      datasetId: "ds-123",
      verified: false,
      computedHash: "def456",
      algorithm: "sha256",
      matchDetails: {
        expectedHash: "abc123",
        match: false,
        bytesVerified: 1024,
      },
      attestation_ref: "att-ref-002",
      freshness: validFreshness,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid algorithm in output", () => {
    const result = verifyHashOutputSchema.safeParse({
      datasetId: "ds-123",
      verified: true,
      computedHash: "abc123",
      algorithm: "md5",
      matchDetails: {
        expectedHash: "abc123",
        match: true,
        bytesVerified: 1024,
      },
      attestation_ref: "att-ref-001",
      freshness: validFreshness,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative bytesVerified", () => {
    const result = verifyHashOutputSchema.safeParse({
      datasetId: "ds-123",
      verified: true,
      computedHash: "abc123",
      algorithm: "sha256",
      matchDetails: {
        expectedHash: "abc123",
        match: true,
        bytesVerified: -1,
      },
      attestation_ref: "att-ref-001",
      freshness: validFreshness,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing attestation_ref", () => {
    const result = verifyHashOutputSchema.safeParse({
      datasetId: "ds-123",
      verified: true,
      computedHash: "abc123",
      algorithm: "sha256",
      matchDetails: {
        expectedHash: "abc123",
        match: true,
        bytesVerified: 1024,
      },
      freshness: validFreshness,
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// Error Schema
// ============================================================
describe("errorSchema", () => {
  it("accepts valid error envelope", () => {
    const result = errorSchema.safeParse({
      error: { code: "VALIDATION_ERROR", message: "Invalid input" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing code", () => {
    const result = errorSchema.safeParse({
      error: { message: "Invalid input" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing message", () => {
    const result = errorSchema.safeParse({
      error: { code: "ERR" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty error object", () => {
    const result = errorSchema.safeParse({ error: {} });
    expect(result.success).toBe(false);
  });
});
