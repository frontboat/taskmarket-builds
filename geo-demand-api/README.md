# geo-demand-api

Geographic demand index, trend analysis, and anomaly detection API for location-based market intelligence.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/demand/index` | Get demand index with confidence interval and comparable geos |
| GET | `/v1/demand/trend` | Get historical trend data points with direction and strength |
| GET | `/v1/demand/anomalies` | Detect demand anomalies (spikes, drops, seasonal deviations) |

## Quick Start

```bash
bun install
bun run dev
bun test
```

## Example Requests

### GET /v1/demand/index

```bash
curl "http://localhost:3000/v1/demand/index?geoType=city&geoCode=NYC&category=electronics&seasonalityMode=adjusted"
```

```json
{
  "geoType": "city",
  "geoCode": "NYC",
  "category": "electronics",
  "demand_index": 142.5,
  "velocity": 3.2,
  "confidence_interval": { "lower": 130.0, "upper": 155.0 },
  "comparable_geos": [
    { "geoCode": "LAX", "demand_index": 138.0, "similarity": 0.87 }
  ],
  "confidence": 0.91,
  "freshness": { "timestamp": "2026-02-27T00:00:00.000Z", "ageSeconds": 0, "stale": false }
}
```

### GET /v1/demand/trend

```bash
curl "http://localhost:3000/v1/demand/trend?geoType=state&geoCode=CA&category=electronics&lookbackWindow=30d"
```

```json
{
  "geoType": "state",
  "geoCode": "CA",
  "category": "electronics",
  "lookbackWindow": "30d",
  "data_points": [
    { "date": "2026-02-01", "demand_index": 130.0, "velocity": 2.1 }
  ],
  "trend_direction": "accelerating",
  "trend_strength": 0.75,
  "freshness": { "timestamp": "2026-02-27T00:00:00.000Z", "ageSeconds": 0, "stale": false }
}
```

### GET /v1/demand/anomalies

```bash
curl "http://localhost:3000/v1/demand/anomalies?geoType=zip&geoCode=10001&threshold=0.8"
```

```json
{
  "geoType": "zip",
  "geoCode": "10001",
  "anomalies": [
    {
      "category": "electronics",
      "anomaly_type": "spike",
      "severity": "high",
      "confidence": 0.92,
      "detected_at": "2026-02-25",
      "description": "Demand spike detected in electronics"
    }
  ],
  "total_anomalies": 1,
  "freshness": { "timestamp": "2026-02-27T00:00:00.000Z", "ageSeconds": 0, "stale": false }
}
```

## Architecture

- **Hono** -- lightweight HTTP framework
- **Zod** -- request/response validation with typed schemas
- **DataSource DI** -- injectable `getDemandData` / `getGeoExists` interface
- **Deterministic scoring** -- hash-based demand index computation for reproducible results
- **Freshness metadata** -- every response includes `timestamp`, `ageSeconds`, `stale`

## Tests

131 tests across 4 files:

- `demand.test.ts` -- 47 tests (index computation, velocity, trends, anomalies)
- `schemas.test.ts` -- 44 tests (input/output schema validation)
- `integration.test.ts` -- 31 tests (full HTTP request/response cycles)
- `freshness.test.ts` -- 9 tests (staleness calculation, timestamp accuracy)
