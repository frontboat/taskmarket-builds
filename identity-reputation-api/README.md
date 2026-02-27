# ERC-8004 Identity Reputation Signal API

A paid identity data API that sells agent trust/reputation signals from ERC-8004 plus verified offchain performance evidence. Built for [Taskmarket](https://market.daydreams.systems) bounty `0xef2c...c554`.

## Endpoints

### GET /v1/identity/reputation

Returns trust score and reputation metrics for an agent.

```bash
curl "http://localhost:3000/v1/identity/reputation?agentAddress=0x92de3C10764a03B2455d5f4A4b7FCBd0e281Aa92"
```

**Parameters:** `agentAddress` (required), `chain` (default: "base"), `timeframe` ("7d"|"30d"|"90d"|"all")

**Response:**
```json
{
  "agentAddress": "0x92de...",
  "trustScore": 70,
  "completionRate": 1,
  "disputeRate": 0,
  "totalTasks": 2,
  "onchainIdentityState": "registered",
  "confidence": 0.17,
  "freshness": { "timestamp": "2026-02-27T02:31:20.958Z", "ageSeconds": 0, "stale": false }
}
```

### GET /v1/identity/history

Returns interaction history with evidence links.

```bash
curl "http://localhost:3000/v1/identity/history?agentAddress=0x...&limit=20&offset=0"
```

**Parameters:** `agentAddress` (required), `chain`, `limit` (1-100, default 20), `offset` (default 0)

### GET /v1/identity/trust-breakdown

Returns component-level trust analysis with weighted scoring.

```bash
curl "http://localhost:3000/v1/identity/trust-breakdown?agentAddress=0x...&evidenceDepth=3"
```

**Parameters:** `agentAddress` (required), `chain`, `evidenceDepth` (1-10, default 3)

**Response includes 4 trust components:**
- `completion_rate` (weight: 0.4) — Task completion track record
- `rating_average` (weight: 0.3) — Average rating from requesters
- `onchain_identity` (weight: 0.2) — ERC-8004 registration status
- `dispute_history` (weight: 0.1) — Dispute/conflict record

## Setup

```bash
bun install
bun run src/index.ts
```

## Testing

```bash
bun test
```

74 tests across 4 test files:
- **Contract tests** — Zod schema validation for all request/response shapes
- **Business logic tests** — Trust scoring, confidence computation, freshness
- **Integration tests** — Full endpoint request/response with mock data source
- **Freshness/quality tests** — Staleness thresholds, confidence propagation, response time (<500ms)

## Architecture

```
src/
  schemas.ts       — Zod schemas for all request/response contracts
  scoring.ts       — Trust score computation, confidence, freshness
  api.ts           — Hono routes with injectable DataSource
  datasource.ts    — Live Taskmarket API data source
  index.ts         — Server entry point
  __tests__/       — TDD test suite (contract → logic → integration → freshness)
```

The API uses dependency injection via the `DataSource` interface, making it easy to swap between the live Taskmarket API and mock data for testing.

## Data Source

Queries the live Taskmarket API:
- `GET /api/agents/stats?address=...` — Agent performance data
- `GET /api/identity/status?address=...` — ERC-8004 registration status

## Scoring Algorithm

**Trust Score** = weighted sum of 4 components (0-100 scale):
- Completion rate × 0.4
- Average rating × 0.3
- On-chain identity × 0.2
- Dispute history × 0.1

**Confidence** (0-1) scales logarithmically with completed tasks and rating coverage. Agents with more data points get higher confidence scores.

**Freshness** tracks data age and flags responses as stale after 300 seconds.
