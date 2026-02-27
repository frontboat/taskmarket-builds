# regulation-delta-api

Regulatory change tracking, impact assessment, and control framework mapping API for compliance monitoring.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/regulations/delta` | Get regulatory changes since a given date for a jurisdiction |
| GET | `/v1/regulations/impact` | Assess impact of regulatory changes on control frameworks |
| POST | `/v1/regulations/map-controls` | Map a rule to specific controls within a compliance framework |

## Quick Start

```bash
bun install
bun run dev
bun test
```

## Example Requests

### GET /v1/regulations/delta

```bash
curl "http://localhost:3000/v1/regulations/delta?jurisdiction=US&since=2026-01-01&source_priority=all"
```

```json
{
  "jurisdiction": "US",
  "deltas": [
    {
      "ruleId": "REG-2026-001",
      "title": "Updated AML Requirements",
      "semantic_change_type": "amendment",
      "summary": "Enhanced customer due diligence requirements",
      "effective_date": "2026-03-01",
      "published_date": "2026-01-15",
      "source_url": "https://example.gov/reg-2026-001",
      "urgency_score": 72
    }
  ],
  "total_changes": 1,
  "freshness": { "timestamp": "2026-02-27T00:00:00.000Z", "ageSeconds": 0, "stale": false }
}
```

### GET /v1/regulations/impact

```bash
curl "http://localhost:3000/v1/regulations/impact?jurisdiction=US&control_framework=soc2"
```

```json
{
  "jurisdiction": "US",
  "impacts": [
    {
      "ruleId": "REG-2026-001",
      "title": "Updated AML Requirements",
      "affected_controls": ["CC6.1", "CC7.2"],
      "impact_level": "high",
      "remediation_urgency": "short_term",
      "estimated_effort": "moderate",
      "description": "Requires updates to access control and monitoring procedures"
    }
  ],
  "total_impacts": 1,
  "freshness": { "timestamp": "2026-02-27T00:00:00.000Z", "ageSeconds": 0, "stale": false }
}
```

### POST /v1/regulations/map-controls

```bash
curl -X POST http://localhost:3000/v1/regulations/map-controls \
  -H "Content-Type: application/json" \
  -d '{"ruleId": "REG-2026-001", "control_framework": "soc2", "jurisdiction": "US"}'
```

```json
{
  "ruleId": "REG-2026-001",
  "control_framework": "soc2",
  "jurisdiction": "US",
  "mapped_controls": [
    {
      "controlId": "CC6.1",
      "controlName": "Logical and Physical Access Controls",
      "mapping_confidence": 0.89,
      "gap_status": "partial_gap",
      "remediation_steps": ["Update access review procedures", "Implement enhanced logging"]
    }
  ],
  "total_mapped": 1,
  "coverage_score": 0.89,
  "freshness": { "timestamp": "2026-02-27T00:00:00.000Z", "ageSeconds": 0, "stale": false }
}
```

## Architecture

- **Hono** -- lightweight HTTP framework
- **Zod** -- request/response validation with typed schemas
- **DataSource DI** -- injectable `getRegulationData` interface
- **Deterministic scoring** -- hash-based delta and impact computation for reproducible results
- **Freshness metadata** -- every response includes `timestamp`, `ageSeconds`, `stale`

## Tests

170 tests across 4 files:

- `schemas.test.ts` -- 76 tests (input/output schema validation)
- `regulation.test.ts` -- 46 tests (delta computation, impact assessment, control mapping)
- `integration.test.ts` -- 33 tests (full HTTP request/response cycles)
- `freshness.test.ts` -- 15 tests (staleness calculation, timestamp accuracy)
