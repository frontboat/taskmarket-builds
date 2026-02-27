# graph-intelligence-api

On-chain address risk scoring, exposure path analysis, and entity profiling API for blockchain graph intelligence.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/risk/score` | Compute risk score and factors for an Ethereum address |
| GET | `/v1/risk/exposure-paths` | Trace risk exposure paths between addresses |
| GET | `/v1/risk/entity-profile` | Get entity type, cluster, and activity profile for an address |

## Quick Start

```bash
bun install
bun run dev
bun test
```

## Example Requests

### POST /v1/risk/score

```bash
curl -X POST http://localhost:3000/v1/risk/score \
  -H "Content-Type: application/json" \
  -d '{"address": "0x1234567890abcdef1234567890abcdef12345678", "network": "base"}'
```

```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "risk_score": 42,
  "risk_level": "medium",
  "risk_factors": [
    { "factor": "mixer_interaction", "score": 60, "weight": 0.3, "description": "Interactions with mixing services" }
  ],
  "sanctions_proximity": 0.15,
  "confidence": 0.88,
  "freshness": { "timestamp": "2026-02-27T00:00:00.000Z", "ageSeconds": 0, "stale": false }
}
```

### GET /v1/risk/exposure-paths

```bash
curl "http://localhost:3000/v1/risk/exposure-paths?address=0x1234567890abcdef1234567890abcdef12345678&network=base&maxHops=3&threshold=50"
```

```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "paths": [
    { "from": "0x1234...5678", "to": "0xabcd...ef01", "relationship": "transfer", "risk_contribution": 65, "hop": 1 }
  ],
  "total_exposure": 65,
  "highest_risk_path_score": 65,
  "freshness": { "timestamp": "2026-02-27T00:00:00.000Z", "ageSeconds": 0, "stale": false }
}
```

### GET /v1/risk/entity-profile

```bash
curl "http://localhost:3000/v1/risk/entity-profile?address=0x1234567890abcdef1234567890abcdef12345678&network=base"
```

```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "cluster_id": "cluster-abc123",
  "entity_type": "individual",
  "related_addresses": ["0xabcd...ef01"],
  "transaction_volume_30d": "15.234",
  "first_seen": "2025-01-15T00:00:00.000Z",
  "last_active": "2026-02-26T00:00:00.000Z",
  "tags": ["active_trader"],
  "confidence": 0.85,
  "freshness": { "timestamp": "2026-02-27T00:00:00.000Z", "ageSeconds": 0, "stale": false }
}
```

## Architecture

- **Hono** -- lightweight HTTP framework
- **Zod** -- request/response validation with typed schemas
- **DataSource DI** -- injectable `getAddressData` interface
- **Deterministic scoring** -- hash-based risk computation for reproducible results
- **Freshness metadata** -- every response includes `timestamp`, `ageSeconds`, `stale`

## Tests

148 tests across 4 files:

- `schemas.test.ts` -- 57 tests (input/output schema validation)
- `risk-scoring.test.ts` -- 42 tests (risk score, exposure paths, entity profiles)
- `integration.test.ts` -- 36 tests (full HTTP request/response cycles)
- `freshness.test.ts` -- 13 tests (staleness calculation, timestamp accuracy)
