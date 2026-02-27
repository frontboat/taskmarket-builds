# compliance-screening-api

Sanctions, PEP, and adverse media screening API with exposure chain analysis and jurisdiction risk scoring.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/screening/check` | Screen an entity against sanctions, PEP, and watchlists |
| GET | `/v1/screening/exposure-chain` | Trace ownership/control chain for an Ethereum address |
| GET | `/v1/screening/jurisdiction-risk` | Get risk score and factors for a jurisdiction |

## Quick Start

```bash
bun install
bun run dev
bun test
```

## Example Requests

### POST /v1/screening/check

```bash
curl -X POST http://localhost:3000/v1/screening/check \
  -H "Content-Type: application/json" \
  -d '{"entityName": "John Doe", "entityType": "individual", "jurisdictions": ["US"]}'
```

```json
{
  "entityName": "John Doe",
  "screening_status": "clear",
  "match_confidence": 0.0,
  "matches": [],
  "evidence_bundle": [],
  "confidence": 0.65,
  "freshness": { "timestamp": "2026-02-27T00:00:00.000Z", "ageSeconds": 0, "stale": false }
}
```

### GET /v1/screening/exposure-chain

```bash
curl "http://localhost:3000/v1/screening/exposure-chain?address=0x1234567890abcdef1234567890abcdef12345678&ownershipDepth=2"
```

```json
{
  "address": "0x1234567890abcdef1234567890abcdef12345678",
  "chain": [
    { "entity": "Entity-A", "relationship": "owner", "riskLevel": "low", "depth": 1 }
  ],
  "aggregate_risk": "low",
  "total_entities_scanned": 1,
  "freshness": { "timestamp": "2026-02-27T00:00:00.000Z", "ageSeconds": 0, "stale": false }
}
```

### GET /v1/screening/jurisdiction-risk

```bash
curl "http://localhost:3000/v1/screening/jurisdiction-risk?jurisdiction=US&industry=finance"
```

```json
{
  "jurisdiction": "US",
  "risk_score": 35,
  "risk_level": "medium",
  "risk_factors": [
    { "factor": "regulatory_complexity", "score": 40, "description": "Complex regulatory environment" }
  ],
  "sanctions_programs": ["OFAC SDN"],
  "last_updated": "2026-02-01T00:00:00.000Z",
  "freshness": { "timestamp": "2026-02-27T00:00:00.000Z", "ageSeconds": 0, "stale": false }
}
```

## Architecture

- **Hono** -- lightweight HTTP framework
- **Zod** -- request/response validation with typed schemas
- **DataSource DI** -- injectable data source interface for testability
- **Deterministic scoring** -- hash-based match generation for reproducible results
- **Freshness metadata** -- every response includes `timestamp`, `ageSeconds`, `stale`

## Tests

179 tests across 4 files:

- `schemas.test.ts` -- 57 tests (input/output schema validation)
- `screening.test.ts` -- 75 tests (scoring logic, match generation, evidence bundles)
- `integration.test.ts` -- 32 tests (full HTTP request/response cycles)
- `freshness.test.ts` -- 15 tests (staleness calculation, timestamp accuracy)
