# data-provenance-api

Dataset lineage tracking, freshness monitoring, and hash verification API for data provenance auditing.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/provenance/lineage` | Get the lineage graph (nodes and edges) for a dataset |
| GET | `/v1/provenance/freshness` | Check dataset staleness against an SLA threshold |
| POST | `/v1/provenance/verify-hash` | Verify a dataset's integrity via cryptographic hash |

## Quick Start

```bash
bun install
bun run dev
bun test
```

## Example Requests

### GET /v1/provenance/lineage

```bash
curl "http://localhost:3000/v1/provenance/lineage?datasetId=ds-001&maxDepth=3"
```

```json
{
  "datasetId": "ds-001",
  "nodes": [
    { "sourceId": "src-01", "type": "raw", "updatedAt": "2026-02-20T00:00:00.000Z", "dataPoints": 50000 }
  ],
  "edges": [
    { "from": "src-01", "to": "ds-001", "transformType": "aggregation" }
  ],
  "freshness": { "timestamp": "2026-02-27T00:00:00.000Z", "ageSeconds": 0, "stale": false }
}
```

### GET /v1/provenance/freshness

```bash
curl "http://localhost:3000/v1/provenance/freshness?datasetId=ds-001&maxStalenessMs=300000"
```

```json
{
  "datasetId": "ds-001",
  "staleness_ms": 120000,
  "sla_status": "fresh",
  "lastUpdated": "2026-02-27T00:00:00.000Z",
  "confidence": 0.92,
  "freshness": { "timestamp": "2026-02-27T00:00:00.000Z", "ageSeconds": 0, "stale": false }
}
```

### POST /v1/provenance/verify-hash

```bash
curl -X POST http://localhost:3000/v1/provenance/verify-hash \
  -H "Content-Type: application/json" \
  -d '{"datasetId": "ds-001", "expectedHash": "abc123def456", "algorithm": "sha256"}'
```

```json
{
  "datasetId": "ds-001",
  "verified": true,
  "computedHash": "abc123def456",
  "algorithm": "sha256",
  "matchDetails": { "expectedHash": "abc123def456", "match": true, "bytesVerified": 1048576 },
  "attestation_ref": "att-ds001-sha256-20260227",
  "freshness": { "timestamp": "2026-02-27T00:00:00.000Z", "ageSeconds": 0, "stale": false }
}
```

## Architecture

- **Hono** -- lightweight HTTP framework
- **Zod** -- request/response validation with typed schemas
- **DataSource DI** -- injectable `getDatasetRecord` / `getAllRecords` interface
- **Deterministic scoring** -- hash-based lineage graph construction for reproducible results
- **Freshness metadata** -- every response includes `timestamp`, `ageSeconds`, `stale`

## Tests

134 tests across 4 files:

- `schemas.test.ts` -- 49 tests (input/output schema validation)
- `verification.test.ts` -- 39 tests (hash verification, lineage graph building, attestation)
- `integration.test.ts` -- 29 tests (full HTTP request/response cycles)
- `freshness.test.ts` -- 17 tests (staleness calculation, SLA status)
