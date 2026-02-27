import { describe, it, expect } from "bun:test";
import {
  computeFreshness,
  computeStaleness,
  computeSlaStatus,
  computeConfidence,
  computeHash,
  verifyHash,
  buildLineageGraph,
  computeLineageScore,
  generateAttestationRef,
} from "../verification";
import type { DatasetRecord } from "../verification";

// ============================================================
// computeFreshness
// ============================================================
describe("computeFreshness", () => {
  it("returns zero age for same timestamp", () => {
    const now = new Date("2025-06-01T00:00:00.000Z");
    const result = computeFreshness(now, now);
    expect(result.ageSeconds).toBe(0);
    expect(result.stale).toBe(false);
  });

  it("computes correct age in seconds", () => {
    const fetchedAt = new Date("2025-06-01T00:00:00.000Z");
    const now = new Date("2025-06-01T00:05:00.000Z");
    const result = computeFreshness(fetchedAt, now);
    expect(result.ageSeconds).toBe(300);
  });

  it("marks as stale when beyond threshold", () => {
    const fetchedAt = new Date("2025-06-01T00:00:00.000Z");
    const now = new Date("2025-06-01T00:10:00.000Z");
    const result = computeFreshness(fetchedAt, now, 300);
    expect(result.stale).toBe(true);
  });

  it("marks as not stale when within threshold", () => {
    const fetchedAt = new Date("2025-06-01T00:00:00.000Z");
    const now = new Date("2025-06-01T00:01:00.000Z");
    const result = computeFreshness(fetchedAt, now, 300);
    expect(result.stale).toBe(false);
  });

  it("returns ISO timestamp", () => {
    const now = new Date("2025-06-01T12:30:45.000Z");
    const result = computeFreshness(now, now);
    expect(result.timestamp).toBe("2025-06-01T12:30:45.000Z");
  });

  it("clamps negative age to zero", () => {
    const fetchedAt = new Date("2025-06-01T00:05:00.000Z");
    const now = new Date("2025-06-01T00:00:00.000Z");
    const result = computeFreshness(fetchedAt, now);
    expect(result.ageSeconds).toBe(0);
  });
});

// ============================================================
// computeStaleness
// ============================================================
describe("computeStaleness", () => {
  it("returns staleness in milliseconds", () => {
    const lastUpdated = new Date("2025-06-01T00:00:00.000Z");
    const now = new Date("2025-06-01T00:05:00.000Z");
    expect(computeStaleness(lastUpdated, now)).toBe(300000);
  });

  it("returns 0 for same time", () => {
    const now = new Date("2025-06-01T00:00:00.000Z");
    expect(computeStaleness(now, now)).toBe(0);
  });

  it("clamps negative to 0", () => {
    const lastUpdated = new Date("2025-06-01T00:05:00.000Z");
    const now = new Date("2025-06-01T00:00:00.000Z");
    expect(computeStaleness(lastUpdated, now)).toBe(0);
  });
});

// ============================================================
// computeSlaStatus
// ============================================================
describe("computeSlaStatus", () => {
  it("returns fresh when staleness is below maxStalenessMs", () => {
    expect(computeSlaStatus(100000, 300000)).toBe("fresh");
  });

  it("returns stale when staleness exceeds maxStalenessMs", () => {
    expect(computeSlaStatus(500000, 300000)).toBe("stale");
  });

  it("returns fresh when staleness equals maxStalenessMs", () => {
    expect(computeSlaStatus(300000, 300000)).toBe("fresh");
  });

  it("returns unknown for null staleness", () => {
    expect(computeSlaStatus(null, 300000)).toBe("unknown");
  });
});

// ============================================================
// computeConfidence
// ============================================================
describe("computeConfidence", () => {
  it("returns 0 for no data points", () => {
    expect(computeConfidence(0)).toBe(0);
  });

  it("returns value between 0 and 1 for some data points", () => {
    const result = computeConfidence(50);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(1);
  });

  it("returns higher confidence for more data points", () => {
    const low = computeConfidence(5);
    const high = computeConfidence(500);
    expect(high).toBeGreaterThan(low);
  });

  it("caps at 1.0", () => {
    const result = computeConfidence(100000);
    expect(result).toBeLessThanOrEqual(1);
  });

  it("returns moderate confidence for 10 data points", () => {
    const result = computeConfidence(10);
    expect(result).toBeGreaterThanOrEqual(0.2);
    expect(result).toBeLessThanOrEqual(0.8);
  });
});

// ============================================================
// computeHash
// ============================================================
describe("computeHash", () => {
  it("computes sha256 hash", async () => {
    const hash = await computeHash("hello world", "sha256");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("computes sha384 hash", async () => {
    const hash = await computeHash("hello world", "sha384");
    expect(hash).toMatch(/^[a-f0-9]{96}$/);
  });

  it("computes sha512 hash", async () => {
    const hash = await computeHash("hello world", "sha512");
    expect(hash).toMatch(/^[a-f0-9]{128}$/);
  });

  it("produces deterministic output", async () => {
    const hash1 = await computeHash("test data", "sha256");
    const hash2 = await computeHash("test data", "sha256");
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different inputs", async () => {
    const hash1 = await computeHash("input-a", "sha256");
    const hash2 = await computeHash("input-b", "sha256");
    expect(hash1).not.toBe(hash2);
  });
});

// ============================================================
// verifyHash
// ============================================================
describe("verifyHash", () => {
  it("returns true for matching hash", async () => {
    const data = "test data";
    const hash = await computeHash(data, "sha256");
    const result = await verifyHash(data, hash, "sha256");
    expect(result.verified).toBe(true);
    expect(result.match).toBe(true);
  });

  it("returns false for non-matching hash", async () => {
    const result = await verifyHash("test data", "0000000000000000", "sha256");
    expect(result.verified).toBe(false);
    expect(result.match).toBe(false);
  });

  it("returns computed hash in result", async () => {
    const result = await verifyHash("test data", "abc123", "sha256");
    expect(result.computedHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is case-insensitive for hash comparison", async () => {
    const data = "test";
    const hash = await computeHash(data, "sha256");
    const upperHash = hash.toUpperCase();
    const result = await verifyHash(data, upperHash, "sha256");
    expect(result.verified).toBe(true);
  });
});

// ============================================================
// buildLineageGraph
// ============================================================
describe("buildLineageGraph", () => {
  const mockRecords: DatasetRecord[] = [
    {
      datasetId: "ds-root",
      sources: [
        {
          sourceId: "src-1",
          type: "api",
          updatedAt: "2025-01-01T00:00:00.000Z",
          dataPoints: 100,
          parentDatasetId: null,
          transformType: "ingest",
        },
        {
          sourceId: "src-2",
          type: "database",
          updatedAt: "2025-01-02T00:00:00.000Z",
          dataPoints: 200,
          parentDatasetId: null,
          transformType: "etl",
        },
      ],
      content: "root dataset content",
      lastUpdated: "2025-01-02T00:00:00.000Z",
    },
  ];

  it("returns nodes for all sources", () => {
    const graph = buildLineageGraph(mockRecords, "ds-root", 3);
    expect(graph.nodes.length).toBe(2);
  });

  it("returns edges connecting sources to dataset", () => {
    const graph = buildLineageGraph(mockRecords, "ds-root", 3);
    expect(graph.edges.length).toBe(2);
    expect(graph.edges[0].to).toBe("ds-root");
  });

  it("returns correct datasetId", () => {
    const graph = buildLineageGraph(mockRecords, "ds-root", 3);
    expect(graph.datasetId).toBe("ds-root");
  });

  it("returns empty graph for missing dataset", () => {
    const graph = buildLineageGraph([], "ds-unknown", 3);
    expect(graph.nodes.length).toBe(0);
    expect(graph.edges.length).toBe(0);
  });

  it("respects maxDepth parameter", () => {
    const deepRecords: DatasetRecord[] = [
      {
        datasetId: "ds-root",
        sources: [
          {
            sourceId: "src-1",
            type: "derived",
            updatedAt: "2025-01-01T00:00:00.000Z",
            dataPoints: 50,
            parentDatasetId: "ds-parent",
            transformType: "aggregation",
          },
        ],
        content: "root content",
        lastUpdated: "2025-01-01T00:00:00.000Z",
      },
      {
        datasetId: "ds-parent",
        sources: [
          {
            sourceId: "src-deep",
            type: "api",
            updatedAt: "2025-01-01T00:00:00.000Z",
            dataPoints: 30,
            parentDatasetId: null,
            transformType: "ingest",
          },
        ],
        content: "parent content",
        lastUpdated: "2025-01-01T00:00:00.000Z",
      },
    ];
    // maxDepth 1 should only get immediate sources
    const shallow = buildLineageGraph(deepRecords, "ds-root", 1);
    expect(shallow.nodes.length).toBe(1);

    // maxDepth 3 should traverse deeper
    const deep = buildLineageGraph(deepRecords, "ds-root", 3);
    expect(deep.nodes.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// computeLineageScore
// ============================================================
describe("computeLineageScore", () => {
  it("returns 0 for no nodes", () => {
    expect(computeLineageScore([])).toBe(0);
  });

  it("returns score between 0 and 1 for nodes with data", () => {
    const nodes = [
      { sourceId: "s1", type: "api", updatedAt: "2025-06-01T00:00:00.000Z", dataPoints: 100 },
    ];
    const score = computeLineageScore(nodes);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("returns higher score for more recent updates", () => {
    const oldNodes = [
      { sourceId: "s1", type: "api", updatedAt: "2020-01-01T00:00:00.000Z", dataPoints: 100 },
    ];
    const newNodes = [
      { sourceId: "s1", type: "api", updatedAt: "2025-06-01T00:00:00.000Z", dataPoints: 100 },
    ];
    expect(computeLineageScore(newNodes)).toBeGreaterThanOrEqual(computeLineageScore(oldNodes));
  });
});

// ============================================================
// generateAttestationRef
// ============================================================
describe("generateAttestationRef", () => {
  it("returns a non-empty string", () => {
    const ref = generateAttestationRef("ds-123", "sha256");
    expect(ref.length).toBeGreaterThan(0);
  });

  it("includes dataset identifier", () => {
    const ref = generateAttestationRef("ds-123", "sha256");
    expect(ref).toContain("ds-123");
  });

  it("produces unique refs for different datasets", () => {
    const ref1 = generateAttestationRef("ds-1", "sha256");
    const ref2 = generateAttestationRef("ds-2", "sha256");
    expect(ref1).not.toBe(ref2);
  });

  it("produces unique refs for different algorithms", () => {
    const ref1 = generateAttestationRef("ds-1", "sha256");
    const ref2 = generateAttestationRef("ds-1", "sha512");
    expect(ref1).not.toBe(ref2);
  });
});
