import { Hono } from "hono";
import {
  lineageInputSchema,
  lineageOutputSchema,
  freshnessInputSchema,
  freshnessOutputSchema,
  verifyHashInputSchema,
  verifyHashOutputSchema,
  type LineageOutput,
  type FreshnessOutput,
  type VerifyHashOutput,
} from "./schemas";
import {
  computeFreshness,
  computeStaleness,
  computeSlaStatus,
  computeConfidence,
  verifyHash,
  buildLineageGraph,
  generateAttestationRef,
  type DatasetRecord,
} from "./verification";

export interface DataSource {
  getDatasetRecord(datasetId: string): Promise<DatasetRecord | null>;
  getAllRecords(): Promise<DatasetRecord[]>;
}

export function createProvenanceAPI(dataSource: DataSource) {
  const app = new Hono();

  // GET /v1/provenance/lineage
  app.get("/v1/provenance/lineage", async (c) => {
    const raw = {
      datasetId: c.req.query("datasetId"),
      maxDepth: c.req.query("maxDepth"),
    };

    const parsed = lineageInputSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, 400);
    }

    const { datasetId, maxDepth } = parsed.data;
    const fetchedAt = new Date();

    const record = await dataSource.getDatasetRecord(datasetId);
    if (!record) {
      return c.json({ error: { code: "DATASET_NOT_FOUND", message: "Dataset not found" } }, 404);
    }

    const allRecords = await dataSource.getAllRecords();
    const graph = buildLineageGraph(allRecords, datasetId, maxDepth);

    const output: LineageOutput = {
      datasetId,
      nodes: graph.nodes,
      edges: graph.edges,
      freshness: computeFreshness(fetchedAt),
    };

    lineageOutputSchema.parse(output);
    return c.json(output);
  });

  // GET /v1/provenance/freshness
  app.get("/v1/provenance/freshness", async (c) => {
    const raw = {
      datasetId: c.req.query("datasetId"),
      maxStalenessMs: c.req.query("maxStalenessMs"),
    };

    const parsed = freshnessInputSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, 400);
    }

    const { datasetId, maxStalenessMs } = parsed.data;
    const fetchedAt = new Date();

    const record = await dataSource.getDatasetRecord(datasetId);
    if (!record) {
      return c.json({ error: { code: "DATASET_NOT_FOUND", message: "Dataset not found" } }, 404);
    }

    const lastUpdatedDate = new Date(record.lastUpdated);
    const stalenessMs = computeStaleness(lastUpdatedDate);
    const slaStatus = computeSlaStatus(stalenessMs, maxStalenessMs);

    // Compute confidence based on total data points across sources
    const totalDataPoints = record.sources.reduce((sum, s) => sum + s.dataPoints, 0);
    const confidence = computeConfidence(totalDataPoints);

    const output: FreshnessOutput = {
      datasetId,
      staleness_ms: stalenessMs,
      sla_status: slaStatus,
      lastUpdated: record.lastUpdated,
      confidence,
      freshness: computeFreshness(fetchedAt),
    };

    freshnessOutputSchema.parse(output);
    return c.json(output);
  });

  // POST /v1/provenance/verify-hash
  app.post("/v1/provenance/verify-hash", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } }, 400);
    }

    const parsed = verifyHashInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } }, 400);
    }

    const { datasetId, expectedHash, algorithm } = parsed.data;
    const fetchedAt = new Date();

    const record = await dataSource.getDatasetRecord(datasetId);
    if (!record) {
      return c.json({ error: { code: "DATASET_NOT_FOUND", message: "Dataset not found" } }, 404);
    }

    const result = await verifyHash(record.content, expectedHash, algorithm);
    const attestationRef = generateAttestationRef(datasetId, algorithm);

    const output: VerifyHashOutput = {
      datasetId,
      verified: result.verified,
      computedHash: result.computedHash,
      algorithm,
      matchDetails: {
        expectedHash,
        match: result.match,
        bytesVerified: result.bytesVerified,
      },
      attestation_ref: attestationRef,
      freshness: computeFreshness(fetchedAt),
    };

    verifyHashOutputSchema.parse(output);
    return c.json(output);
  });

  return app;
}
