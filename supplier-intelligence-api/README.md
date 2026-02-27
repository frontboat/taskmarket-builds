# supplier-intelligence-api

Supplier scoring, lead time forecasting, and disruption alert API for supply chain risk intelligence.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/suppliers/score` | Get supplier reliability score, fill rate, and risk factors |
| GET | `/v1/suppliers/lead-time-forecast` | Forecast lead time percentiles and drift direction |
| GET | `/v1/suppliers/disruption-alerts` | Get disruption alerts filtered by supplier, region, or risk tolerance |

## Quick Start

```bash
bun install
bun run dev
bun test
```

## Example Requests

### GET /v1/suppliers/score

```bash
curl "http://localhost:3000/v1/suppliers/score?supplierId=SUP-001&category=raw_materials&region=APAC"
```

```json
{
  "supplierId": "SUP-001",
  "supplier_score": 78,
  "reliability_grade": "B",
  "fill_rate": 0.94,
  "on_time_rate": 0.88,
  "defect_rate": 0.03,
  "risk_factors": [
    { "factor": "geographic_concentration", "severity": "medium", "description": "Single-region sourcing" }
  ],
  "confidence": 0.87,
  "freshness": { "timestamp": "2026-02-27T00:00:00.000Z", "ageSeconds": 0, "stale": false }
}
```

### GET /v1/suppliers/lead-time-forecast

```bash
curl "http://localhost:3000/v1/suppliers/lead-time-forecast?supplierId=SUP-001&horizonDays=30"
```

```json
{
  "supplierId": "SUP-001",
  "lead_time_p50": 12,
  "lead_time_p95": 21,
  "drift_direction": "stable",
  "drift_magnitude": 0.05,
  "forecast_window_days": 30,
  "historical_variance": 3.2,
  "confidence": 0.87,
  "freshness": { "timestamp": "2026-02-27T00:00:00.000Z", "ageSeconds": 0, "stale": false }
}
```

### GET /v1/suppliers/disruption-alerts

```bash
curl "http://localhost:3000/v1/suppliers/disruption-alerts?region=APAC&riskTolerance=medium"
```

```json
{
  "alerts": [
    {
      "supplierId": "SUP-001",
      "alert_type": "logistics",
      "severity": "high",
      "disruption_probability": 0.72,
      "affected_categories": ["raw_materials"],
      "affected_regions": ["APAC"],
      "detected_at": "2026-02-26T00:00:00.000Z",
      "description": "Port congestion affecting APAC shipping routes"
    }
  ],
  "total_alerts": 1,
  "freshness": { "timestamp": "2026-02-27T00:00:00.000Z", "ageSeconds": 0, "stale": false }
}
```

## Architecture

- **Hono** -- lightweight HTTP framework
- **Zod** -- request/response validation with typed schemas
- **DataSource DI** -- injectable `getSupplierData` / `getAllSupplierAlerts` interface
- **Deterministic scoring** -- hash-based supplier scoring for reproducible results
- **Freshness metadata** -- every response includes `timestamp`, `ageSeconds`, `stale`

## Tests

178 tests across 4 files:

- `schemas.test.ts` -- 65 tests (input/output schema validation)
- `supplier-scoring.test.ts` -- 65 tests (score computation, lead time forecast, disruption alerts)
- `integration.test.ts` -- 33 tests (full HTTP request/response cycles)
- `freshness.test.ts` -- 15 tests (staleness calculation, timestamp accuracy)
