import { describe, it, expect, beforeAll } from "bun:test";
import { createRiskAPI, type DataSource } from "../api";
import { createMockDataSource } from "../datasource";
import {
  riskScoreOutputSchema,
  exposurePathsOutputSchema,
  entityProfileOutputSchema,
  errorSchema,
} from "../schemas";

let app: ReturnType<typeof createRiskAPI>;
let mockDataSource: DataSource;

beforeAll(() => {
  mockDataSource = createMockDataSource();
  app = createRiskAPI(mockDataSource);
});

const VALID_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";
const UNKNOWN_ADDRESS = "0x0000000000000000000000000000000000000000";

// --- POST /v1/risk/score ---

describe("POST /v1/risk/score", () => {
  it("returns 200 with valid risk score for valid address", async () => {
    const res = await app.request("/v1/risk/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: VALID_ADDRESS }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(riskScoreOutputSchema.safeParse(data).success).toBe(true);
    expect(data.address).toBe(VALID_ADDRESS);
  });

  it("applies default network and lookback_days", async () => {
    const res = await app.request("/v1/risk/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: VALID_ADDRESS }),
    });
    const data = await res.json();
    expect(data.risk_score).toBeGreaterThanOrEqual(0);
    expect(data.risk_score).toBeLessThanOrEqual(100);
  });

  it("accepts optional transaction_context", async () => {
    const res = await app.request("/v1/risk/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: VALID_ADDRESS,
        transaction_context: "uniswap swap",
      }),
    });
    expect(res.status).toBe(200);
  });

  it("accepts explicit network and lookback_days", async () => {
    const res = await app.request("/v1/risk/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: VALID_ADDRESS,
        network: "ethereum",
        lookback_days: 90,
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(riskScoreOutputSchema.safeParse(data).success).toBe(true);
  });

  it("returns 400 for missing address", async () => {
    const res = await app.request("/v1/risk/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(errorSchema.safeParse(data).success).toBe(true);
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid address format", async () => {
    const res = await app.request("/v1/risk/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: "not-an-address" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for lookback_days out of range", async () => {
    const res = await app.request("/v1/risk/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: VALID_ADDRESS, lookback_days: 0 }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid network", async () => {
    const res = await app.request("/v1/risk/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: VALID_ADDRESS, network: "solana" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown address", async () => {
    const res = await app.request("/v1/risk/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: UNKNOWN_ADDRESS }),
    });
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error.code).toBe("ADDRESS_NOT_FOUND");
  });

  it("risk_factors array is non-empty", async () => {
    const res = await app.request("/v1/risk/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: VALID_ADDRESS }),
    });
    const data = await res.json();
    expect(data.risk_factors.length).toBeGreaterThan(0);
  });

  it("sanctions_proximity is between 0 and 1", async () => {
    const res = await app.request("/v1/risk/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: VALID_ADDRESS }),
    });
    const data = await res.json();
    expect(data.sanctions_proximity).toBeGreaterThanOrEqual(0);
    expect(data.sanctions_proximity).toBeLessThanOrEqual(1);
  });

  it("freshness is included in response", async () => {
    const res = await app.request("/v1/risk/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: VALID_ADDRESS }),
    });
    const data = await res.json();
    expect(data.freshness).toBeDefined();
    expect(data.freshness.timestamp).toBeDefined();
    expect(typeof data.freshness.ageSeconds).toBe("number");
    expect(typeof data.freshness.stale).toBe("boolean");
  });

  it("is deterministic - same address gives same risk_score", async () => {
    const addr = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
    const res1 = await app.request("/v1/risk/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: addr }),
    });
    const res2 = await app.request("/v1/risk/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: addr }),
    });
    const d1 = await res1.json();
    const d2 = await res2.json();
    expect(d1.risk_score).toBe(d2.risk_score);
    expect(d1.risk_level).toBe(d2.risk_level);
  });
});

// --- GET /v1/risk/exposure-paths ---

describe("GET /v1/risk/exposure-paths", () => {
  it("returns 200 with valid exposure paths", async () => {
    const res = await app.request(`/v1/risk/exposure-paths?address=${VALID_ADDRESS}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(exposurePathsOutputSchema.safeParse(data).success).toBe(true);
    expect(data.address).toBe(VALID_ADDRESS);
  });

  it("applies default threshold and maxHops", async () => {
    const res = await app.request(`/v1/risk/exposure-paths?address=${VALID_ADDRESS}`);
    const data = await res.json();
    expect(data.total_exposure).toBeGreaterThanOrEqual(0);
    expect(data.total_exposure).toBeLessThanOrEqual(100);
  });

  it("accepts custom threshold and maxHops", async () => {
    const res = await app.request(
      `/v1/risk/exposure-paths?address=${VALID_ADDRESS}&threshold=75&maxHops=5`
    );
    expect(res.status).toBe(200);
  });

  it("returns 400 for missing address", async () => {
    const res = await app.request("/v1/risk/exposure-paths");
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid address", async () => {
    const res = await app.request("/v1/risk/exposure-paths?address=0xinvalid");
    expect(res.status).toBe(400);
  });

  it("returns 400 for maxHops above 6", async () => {
    const res = await app.request(
      `/v1/risk/exposure-paths?address=${VALID_ADDRESS}&maxHops=7`
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown address", async () => {
    const res = await app.request(`/v1/risk/exposure-paths?address=${UNKNOWN_ADDRESS}`);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error.code).toBe("ADDRESS_NOT_FOUND");
  });

  it("paths have ascending hop numbers", async () => {
    const res = await app.request(`/v1/risk/exposure-paths?address=${VALID_ADDRESS}&threshold=0`);
    const data = await res.json();
    if (data.paths.length > 0) {
      expect(data.paths[0].hop).toBe(1);
      for (let i = 1; i < data.paths.length; i++) {
        expect(data.paths[i].hop).toBeGreaterThan(data.paths[i - 1].hop);
      }
    }
  });

  it("highest_risk_path_score is <= 100", async () => {
    const res = await app.request(`/v1/risk/exposure-paths?address=${VALID_ADDRESS}`);
    const data = await res.json();
    expect(data.highest_risk_path_score).toBeLessThanOrEqual(100);
    expect(data.highest_risk_path_score).toBeGreaterThanOrEqual(0);
  });

  it("freshness is included in response", async () => {
    const res = await app.request(`/v1/risk/exposure-paths?address=${VALID_ADDRESS}`);
    const data = await res.json();
    expect(data.freshness).toBeDefined();
  });
});

// --- GET /v1/risk/entity-profile ---

describe("GET /v1/risk/entity-profile", () => {
  it("returns 200 with valid entity profile", async () => {
    const res = await app.request(`/v1/risk/entity-profile?address=${VALID_ADDRESS}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(entityProfileOutputSchema.safeParse(data).success).toBe(true);
    expect(data.address).toBe(VALID_ADDRESS);
  });

  it("returns cluster_id as a string", async () => {
    const res = await app.request(`/v1/risk/entity-profile?address=${VALID_ADDRESS}`);
    const data = await res.json();
    expect(typeof data.cluster_id).toBe("string");
    expect(data.cluster_id.length).toBeGreaterThan(0);
  });

  it("returns valid entity_type", async () => {
    const res = await app.request(`/v1/risk/entity-profile?address=${VALID_ADDRESS}`);
    const data = await res.json();
    const validTypes = ["individual", "exchange", "defi_protocol", "bridge", "mixer", "unknown"];
    expect(validTypes).toContain(data.entity_type);
  });

  it("returns related_addresses as an array", async () => {
    const res = await app.request(`/v1/risk/entity-profile?address=${VALID_ADDRESS}`);
    const data = await res.json();
    expect(Array.isArray(data.related_addresses)).toBe(true);
  });

  it("accepts custom network", async () => {
    const res = await app.request(
      `/v1/risk/entity-profile?address=${VALID_ADDRESS}&network=polygon`
    );
    expect(res.status).toBe(200);
  });

  it("returns 400 for missing address", async () => {
    const res = await app.request("/v1/risk/entity-profile");
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid address format", async () => {
    const res = await app.request("/v1/risk/entity-profile?address=invalid");
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown address", async () => {
    const res = await app.request(`/v1/risk/entity-profile?address=${UNKNOWN_ADDRESS}`);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error.code).toBe("ADDRESS_NOT_FOUND");
  });

  it("first_seen is a valid datetime", async () => {
    const res = await app.request(`/v1/risk/entity-profile?address=${VALID_ADDRESS}`);
    const data = await res.json();
    expect(() => new Date(data.first_seen)).not.toThrow();
    expect(new Date(data.first_seen).getTime()).not.toBeNaN();
  });

  it("last_active is a valid datetime after first_seen", async () => {
    const res = await app.request(`/v1/risk/entity-profile?address=${VALID_ADDRESS}`);
    const data = await res.json();
    expect(new Date(data.first_seen).getTime()).toBeLessThanOrEqual(
      new Date(data.last_active).getTime()
    );
  });

  it("tags is an array of strings", async () => {
    const res = await app.request(`/v1/risk/entity-profile?address=${VALID_ADDRESS}`);
    const data = await res.json();
    expect(Array.isArray(data.tags)).toBe(true);
    for (const tag of data.tags) {
      expect(typeof tag).toBe("string");
    }
  });

  it("freshness is included in response", async () => {
    const res = await app.request(`/v1/risk/entity-profile?address=${VALID_ADDRESS}`);
    const data = await res.json();
    expect(data.freshness).toBeDefined();
    expect(data.freshness.timestamp).toBeDefined();
  });

  it("is deterministic - same address gives same profile", async () => {
    const addr = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
    const res1 = await app.request(`/v1/risk/entity-profile?address=${addr}`);
    const res2 = await app.request(`/v1/risk/entity-profile?address=${addr}`);
    const d1 = await res1.json();
    const d2 = await res2.json();
    expect(d1.cluster_id).toBe(d2.cluster_id);
    expect(d1.entity_type).toBe(d2.entity_type);
    expect(d1.confidence).toBe(d2.confidence);
  });
});
