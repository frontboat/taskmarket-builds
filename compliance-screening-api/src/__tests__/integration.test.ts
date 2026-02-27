import { describe, test, expect } from "bun:test";
import { createScreeningAPI, type DataSource } from "../api";
import {
  screeningCheckOutputSchema,
  exposureChainOutputSchema,
  jurisdictionRiskOutputSchema,
  errorSchema,
} from "../schemas";

// Mock DataSource
function createMockDataSource(overrides: Partial<DataSource> = {}): DataSource {
  return {
    checkEntity: async () => ({ found: true }),
    getAddressInfo: async () => ({ exists: true }),
    getJurisdictionData: async () => ({ supported: true }),
    ...overrides,
  };
}

function createApp(overrides: Partial<DataSource> = {}) {
  return createScreeningAPI(createMockDataSource(overrides));
}

// --- POST /v1/screening/check ---

describe("POST /v1/screening/check", () => {
  test("returns 200 with valid input", async () => {
    const app = createApp();
    const res = await app.request("/v1/screening/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityName: "John Doe" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entityName).toBe("John Doe");
  });

  test("output validates against schema", async () => {
    const app = createApp();
    const res = await app.request("/v1/screening/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityName: "Test Entity" }),
    });
    const body = await res.json();
    const result = screeningCheckOutputSchema.safeParse(body);
    expect(result.success).toBe(true);
  });

  test("returns 400 for missing entityName", async () => {
    const app = createApp();
    const res = await app.request("/v1/screening/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("returns 400 for empty entityName", async () => {
    const app = createApp();
    const res = await app.request("/v1/screening/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityName: "" }),
    });
    expect(res.status).toBe(400);
  });

  test("returns 400 for invalid JSON body", async () => {
    const app = createApp();
    const res = await app.request("/v1/screening/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("error response validates against error schema", async () => {
    const app = createApp();
    const res = await app.request("/v1/screening/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const body = await res.json();
    const result = errorSchema.safeParse(body);
    expect(result.success).toBe(true);
  });

  test("accepts full input with identifiers and addresses", async () => {
    const app = createApp();
    const res = await app.request("/v1/screening/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityName: "Acme Corp",
        entityType: "organization",
        identifiers: [{ type: "tax_id", value: "123-45-6789" }],
        addresses: ["0x1234567890abcdef1234567890abcdef12345678"],
        jurisdictions: ["US"],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entityName).toBe("Acme Corp");
  });

  test("includes freshness in response", async () => {
    const app = createApp();
    const res = await app.request("/v1/screening/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityName: "Test" }),
    });
    const body = await res.json();
    expect(body.freshness).toBeDefined();
    expect(body.freshness.timestamp).toBeDefined();
    expect(typeof body.freshness.ageSeconds).toBe("number");
  });

  test("returns deterministic results for same input", async () => {
    const app = createApp();
    const makeReq = () =>
      app.request("/v1/screening/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityName: "Deterministic Test" }),
      });

    const [res1, res2] = await Promise.all([makeReq(), makeReq()]);
    const [body1, body2] = await Promise.all([res1.json(), res2.json()]);

    expect(body1.screening_status).toBe(body2.screening_status);
    expect(body1.matches.length).toBe(body2.matches.length);
    expect(body1.match_confidence).toBe(body2.match_confidence);
  });

  test("returns 400 for invalid entityType", async () => {
    const app = createApp();
    const res = await app.request("/v1/screening/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityName: "Test", entityType: "government" }),
    });
    expect(res.status).toBe(400);
  });

  test("includes evidence_bundle in response", async () => {
    const app = createApp();
    const res = await app.request("/v1/screening/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityName: "Test" }),
    });
    const body = await res.json();
    expect(Array.isArray(body.evidence_bundle)).toBe(true);
    expect(body.evidence_bundle.length).toBeGreaterThanOrEqual(1);
  });

  test("confidence is between 0 and 1", async () => {
    const app = createApp();
    const res = await app.request("/v1/screening/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityName: "Test" }),
    });
    const body = await res.json();
    expect(body.confidence).toBeGreaterThanOrEqual(0);
    expect(body.confidence).toBeLessThanOrEqual(1);
  });
});

// --- GET /v1/screening/exposure-chain ---

describe("GET /v1/screening/exposure-chain", () => {
  test("returns 200 with valid address", async () => {
    const app = createApp();
    const res = await app.request(
      "/v1/screening/exposure-chain?address=0x1234567890abcdef1234567890abcdef12345678"
    );
    expect(res.status).toBe(200);
  });

  test("output validates against schema", async () => {
    const app = createApp();
    const res = await app.request(
      "/v1/screening/exposure-chain?address=0x1234567890abcdef1234567890abcdef12345678"
    );
    const body = await res.json();
    const result = exposureChainOutputSchema.safeParse(body);
    expect(result.success).toBe(true);
  });

  test("returns 400 for invalid address", async () => {
    const app = createApp();
    const res = await app.request("/v1/screening/exposure-chain?address=not-an-address");
    expect(res.status).toBe(400);
  });

  test("returns 400 for missing address", async () => {
    const app = createApp();
    const res = await app.request("/v1/screening/exposure-chain");
    expect(res.status).toBe(400);
  });

  test("returns 404 when address not found", async () => {
    const app = createApp({
      getAddressInfo: async () => null,
    });
    const res = await app.request(
      "/v1/screening/exposure-chain?address=0x1234567890abcdef1234567890abcdef12345678"
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("ADDRESS_NOT_FOUND");
  });

  test("respects ownershipDepth parameter", async () => {
    const app = createApp();
    const res = await app.request(
      "/v1/screening/exposure-chain?address=0x1234567890abcdef1234567890abcdef12345678&ownershipDepth=1"
    );
    const body = await res.json();
    for (const entity of body.chain) {
      expect(entity.depth).toBe(1);
    }
  });

  test("defaults ownershipDepth to 2", async () => {
    const app = createApp();
    const res = await app.request(
      "/v1/screening/exposure-chain?address=0x1234567890abcdef1234567890abcdef12345678"
    );
    const body = await res.json();
    const maxDepth = Math.max(...body.chain.map((e: any) => e.depth));
    expect(maxDepth).toBeLessThanOrEqual(2);
  });

  test("returns 400 for ownershipDepth > 5", async () => {
    const app = createApp();
    const res = await app.request(
      "/v1/screening/exposure-chain?address=0x1234567890abcdef1234567890abcdef12345678&ownershipDepth=6"
    );
    expect(res.status).toBe(400);
  });

  test("returns aggregate_risk", async () => {
    const app = createApp();
    const res = await app.request(
      "/v1/screening/exposure-chain?address=0x1234567890abcdef1234567890abcdef12345678"
    );
    const body = await res.json();
    expect(["low", "medium", "high", "critical"]).toContain(body.aggregate_risk);
  });

  test("total_entities_scanned matches chain length", async () => {
    const app = createApp();
    const res = await app.request(
      "/v1/screening/exposure-chain?address=0x1234567890abcdef1234567890abcdef12345678"
    );
    const body = await res.json();
    expect(body.total_entities_scanned).toBe(body.chain.length);
  });

  test("includes freshness", async () => {
    const app = createApp();
    const res = await app.request(
      "/v1/screening/exposure-chain?address=0x1234567890abcdef1234567890abcdef12345678"
    );
    const body = await res.json();
    expect(body.freshness).toBeDefined();
    expect(body.freshness.stale).toBe(false);
  });
});

// --- GET /v1/screening/jurisdiction-risk ---

describe("GET /v1/screening/jurisdiction-risk", () => {
  test("returns 200 for valid jurisdiction", async () => {
    const app = createApp();
    const res = await app.request("/v1/screening/jurisdiction-risk?jurisdiction=US");
    expect(res.status).toBe(200);
  });

  test("output validates against schema", async () => {
    const app = createApp();
    const res = await app.request("/v1/screening/jurisdiction-risk?jurisdiction=GB");
    const body = await res.json();
    const result = jurisdictionRiskOutputSchema.safeParse(body);
    expect(result.success).toBe(true);
  });

  test("returns 400 for lowercase jurisdiction", async () => {
    const app = createApp();
    const res = await app.request("/v1/screening/jurisdiction-risk?jurisdiction=us");
    expect(res.status).toBe(400);
  });

  test("returns 400 for missing jurisdiction", async () => {
    const app = createApp();
    const res = await app.request("/v1/screening/jurisdiction-risk");
    expect(res.status).toBe(400);
  });

  test("returns 404 when jurisdiction not found", async () => {
    const app = createApp({
      getJurisdictionData: async () => null,
    });
    const res = await app.request("/v1/screening/jurisdiction-risk?jurisdiction=US");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("JURISDICTION_NOT_FOUND");
  });

  test("accepts optional industry parameter", async () => {
    const app = createApp();
    const res = await app.request("/v1/screening/jurisdiction-risk?jurisdiction=US&industry=banking");
    expect(res.status).toBe(200);
    const body = await res.json();
    // Should have industry-specific risk factor
    const industryFactor = body.risk_factors.find((f: any) => f.factor.includes("banking"));
    expect(industryFactor).toBeDefined();
  });

  test("risk_score is between 0 and 100", async () => {
    const app = createApp();
    const res = await app.request("/v1/screening/jurisdiction-risk?jurisdiction=IR");
    const body = await res.json();
    expect(body.risk_score).toBeGreaterThanOrEqual(0);
    expect(body.risk_score).toBeLessThanOrEqual(100);
  });

  test("includes sanctions_programs for sanctioned jurisdictions", async () => {
    const app = createApp();
    const res = await app.request("/v1/screening/jurisdiction-risk?jurisdiction=KP");
    const body = await res.json();
    expect(body.sanctions_programs.length).toBeGreaterThan(0);
  });

  test("includes freshness and last_updated", async () => {
    const app = createApp();
    const res = await app.request("/v1/screening/jurisdiction-risk?jurisdiction=US");
    const body = await res.json();
    expect(body.freshness).toBeDefined();
    expect(body.last_updated).toBeDefined();
  });
});
