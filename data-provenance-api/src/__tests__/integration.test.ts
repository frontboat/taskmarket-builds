import { describe, it, expect, beforeAll } from "bun:test";
import { createProvenanceAPI, type DataSource } from "../api";
import type { DatasetRecord } from "../verification";

// ============================================================
// Mock DataSource
// ============================================================
function createMockDataSource(): DataSource {
  const records: DatasetRecord[] = [
    {
      datasetId: "ds-001",
      sources: [
        {
          sourceId: "src-api-weather",
          type: "api",
          updatedAt: "2025-06-01T10:00:00.000Z",
          dataPoints: 5000,
          parentDatasetId: null,
          transformType: "ingest",
        },
        {
          sourceId: "src-db-sensors",
          type: "database",
          updatedAt: "2025-06-01T09:30:00.000Z",
          dataPoints: 12000,
          parentDatasetId: null,
          transformType: "etl",
        },
      ],
      content: "weather dataset aggregate content payload for hashing",
      lastUpdated: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
    },
    {
      datasetId: "ds-002",
      sources: [
        {
          sourceId: "src-derived-1",
          type: "derived",
          updatedAt: "2025-06-01T08:00:00.000Z",
          dataPoints: 300,
          parentDatasetId: "ds-001",
          transformType: "aggregation",
        },
      ],
      content: "derived dataset content",
      lastUpdated: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
    },
    {
      datasetId: "ds-stale",
      sources: [],
      content: "stale data",
      lastUpdated: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    },
  ];

  return {
    async getDatasetRecord(datasetId: string): Promise<DatasetRecord | null> {
      return records.find((r) => r.datasetId === datasetId) ?? null;
    },
    async getAllRecords(): Promise<DatasetRecord[]> {
      return records;
    },
  };
}

// ============================================================
// Integration Tests
// ============================================================
describe("GET /v1/provenance/lineage", () => {
  const app = createProvenanceAPI(createMockDataSource());

  it("returns lineage graph for existing dataset", async () => {
    const res = await app.request("/v1/provenance/lineage?datasetId=ds-001");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.datasetId).toBe("ds-001");
    expect(body.nodes.length).toBe(2);
    expect(body.edges.length).toBe(2);
    expect(body.freshness).toBeDefined();
    expect(body.freshness.timestamp).toBeDefined();
  });

  it("returns 400 for missing datasetId", async () => {
    const res = await app.request("/v1/provenance/lineage");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 for unknown dataset", async () => {
    const res = await app.request("/v1/provenance/lineage?datasetId=ds-unknown");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("DATASET_NOT_FOUND");
  });

  it("accepts custom maxDepth", async () => {
    const res = await app.request("/v1/provenance/lineage?datasetId=ds-001&maxDepth=1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nodes.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects maxDepth outside range", async () => {
    const res = await app.request("/v1/provenance/lineage?datasetId=ds-001&maxDepth=0");
    expect(res.status).toBe(400);
  });

  it("returns correct node structure", async () => {
    const res = await app.request("/v1/provenance/lineage?datasetId=ds-001");
    const body = await res.json();
    const node = body.nodes[0];
    expect(node.sourceId).toBeDefined();
    expect(node.type).toBeDefined();
    expect(node.updatedAt).toBeDefined();
    expect(typeof node.dataPoints).toBe("number");
  });

  it("returns correct edge structure", async () => {
    const res = await app.request("/v1/provenance/lineage?datasetId=ds-001");
    const body = await res.json();
    const edge = body.edges[0];
    expect(edge.from).toBeDefined();
    expect(edge.to).toBeDefined();
    expect(edge.transformType).toBeDefined();
  });

  it("returns empty graph for dataset with no sources", async () => {
    const res = await app.request("/v1/provenance/lineage?datasetId=ds-stale");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nodes.length).toBe(0);
    expect(body.edges.length).toBe(0);
  });
});

describe("GET /v1/provenance/freshness", () => {
  const app = createProvenanceAPI(createMockDataSource());

  it("returns freshness SLA for existing dataset", async () => {
    const res = await app.request("/v1/provenance/freshness?datasetId=ds-001");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.datasetId).toBe("ds-001");
    expect(typeof body.staleness_ms).toBe("number");
    expect(["fresh", "stale", "unknown"]).toContain(body.sla_status);
    expect(body.lastUpdated).toBeDefined();
    expect(typeof body.confidence).toBe("number");
    expect(body.freshness).toBeDefined();
  });

  it("returns fresh status for recently updated dataset", async () => {
    const res = await app.request("/v1/provenance/freshness?datasetId=ds-001&maxStalenessMs=300000");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sla_status).toBe("fresh");
  });

  it("returns stale status for old dataset", async () => {
    const res = await app.request("/v1/provenance/freshness?datasetId=ds-stale&maxStalenessMs=60000");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sla_status).toBe("stale");
  });

  it("returns 400 for missing datasetId", async () => {
    const res = await app.request("/v1/provenance/freshness");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 for unknown dataset", async () => {
    const res = await app.request("/v1/provenance/freshness?datasetId=ds-unknown");
    expect(res.status).toBe(404);
  });

  it("respects custom maxStalenessMs threshold", async () => {
    // ds-001 is 1 minute old; with 30s threshold it should be stale
    const res = await app.request("/v1/provenance/freshness?datasetId=ds-001&maxStalenessMs=30000");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sla_status).toBe("stale");
  });

  it("confidence is between 0 and 1", async () => {
    const res = await app.request("/v1/provenance/freshness?datasetId=ds-001");
    const body = await res.json();
    expect(body.confidence).toBeGreaterThanOrEqual(0);
    expect(body.confidence).toBeLessThanOrEqual(1);
  });
});

describe("POST /v1/provenance/verify-hash", () => {
  const mockDs = createMockDataSource();
  const app = createProvenanceAPI(mockDs);

  it("verifies matching hash", async () => {
    // First, get the content to compute expected hash
    const record = await mockDs.getDatasetRecord("ds-001");
    const content = record!.content;
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const expectedHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const res = await app.request("/v1/provenance/verify-hash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datasetId: "ds-001",
        expectedHash,
        algorithm: "sha256",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verified).toBe(true);
    expect(body.computedHash).toBe(expectedHash);
    expect(body.algorithm).toBe("sha256");
    expect(body.matchDetails.match).toBe(true);
    expect(body.attestation_ref).toBeDefined();
  });

  it("returns false for non-matching hash", async () => {
    const res = await app.request("/v1/provenance/verify-hash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datasetId: "ds-001",
        expectedHash: "0000000000000000000000000000000000000000000000000000000000000000",
        algorithm: "sha256",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.verified).toBe(false);
    expect(body.matchDetails.match).toBe(false);
  });

  it("returns 400 for missing datasetId", async () => {
    const res = await app.request("/v1/provenance/verify-hash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedHash: "abc123",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing expectedHash", async () => {
    const res = await app.request("/v1/provenance/verify-hash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datasetId: "ds-001",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-hex expectedHash", async () => {
    const res = await app.request("/v1/provenance/verify-hash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datasetId: "ds-001",
        expectedHash: "not-hex!",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid algorithm", async () => {
    const res = await app.request("/v1/provenance/verify-hash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datasetId: "ds-001",
        expectedHash: "abc123",
        algorithm: "md5",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown dataset", async () => {
    const res = await app.request("/v1/provenance/verify-hash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datasetId: "ds-unknown",
        expectedHash: "abc123",
      }),
    });
    expect(res.status).toBe(404);
  });

  it("defaults to sha256 algorithm", async () => {
    const res = await app.request("/v1/provenance/verify-hash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datasetId: "ds-001",
        expectedHash: "abc123",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.algorithm).toBe("sha256");
  });

  it("supports sha384 algorithm", async () => {
    const res = await app.request("/v1/provenance/verify-hash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datasetId: "ds-001",
        expectedHash: "abc123",
        algorithm: "sha384",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.algorithm).toBe("sha384");
  });

  it("supports sha512 algorithm", async () => {
    const res = await app.request("/v1/provenance/verify-hash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datasetId: "ds-001",
        expectedHash: "abc123",
        algorithm: "sha512",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.algorithm).toBe("sha512");
  });

  it("includes freshness in verify-hash response", async () => {
    const res = await app.request("/v1/provenance/verify-hash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datasetId: "ds-001",
        expectedHash: "abc123",
      }),
    });
    const body = await res.json();
    expect(body.freshness).toBeDefined();
    expect(body.freshness.timestamp).toBeDefined();
    expect(typeof body.freshness.ageSeconds).toBe("number");
    expect(typeof body.freshness.stale).toBe("boolean");
  });

  it("includes bytesVerified in matchDetails", async () => {
    const res = await app.request("/v1/provenance/verify-hash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datasetId: "ds-001",
        expectedHash: "abc123",
      }),
    });
    const body = await res.json();
    expect(body.matchDetails.bytesVerified).toBeGreaterThan(0);
  });
});

describe("Error handling", () => {
  const app = createProvenanceAPI(createMockDataSource());

  it("returns error envelope on validation failure", async () => {
    const res = await app.request("/v1/provenance/lineage");
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(typeof body.error.code).toBe("string");
    expect(typeof body.error.message).toBe("string");
  });

  it("returns error envelope on not found", async () => {
    const res = await app.request("/v1/provenance/lineage?datasetId=nonexistent");
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("DATASET_NOT_FOUND");
  });
});
