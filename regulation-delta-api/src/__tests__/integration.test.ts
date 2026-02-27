import { describe, test, expect } from "bun:test";
import { createRegulationAPI, type DataSource } from "../api";
import {
  deltaOutputSchema,
  impactOutputSchema,
  mapControlsOutputSchema,
  errorSchema,
} from "../schemas";

// Mock DataSource that returns deterministic data
function createMockDataSource(): DataSource {
  return {
    async getRegulationData(jurisdiction: string) {
      if (jurisdiction === "XX") return null; // simulate unknown jurisdiction
      return { jurisdiction, available: true };
    },
  };
}

function createApp() {
  return createRegulationAPI(createMockDataSource());
}

// --- GET /v1/regulations/delta ---

describe("GET /v1/regulations/delta", () => {
  test("returns 200 with valid delta response", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/delta?jurisdiction=US&since=2025-01-01");
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = deltaOutputSchema.safeParse(body);
    expect(parsed.success).toBe(true);
  });

  test("response includes jurisdiction from input", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/delta?jurisdiction=US&since=2025-01-01");
    const body = await res.json();
    expect(body.jurisdiction).toBe("US");
  });

  test("response total_changes matches deltas array length", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/delta?jurisdiction=US&since=2025-01-01");
    const body = await res.json();
    expect(body.total_changes).toBe(body.deltas.length);
  });

  test("response includes freshness metadata", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/delta?jurisdiction=US&since=2025-01-01");
    const body = await res.json();
    expect(body.freshness).toBeDefined();
    expect(body.freshness.timestamp).toBeDefined();
    expect(typeof body.freshness.ageSeconds).toBe("number");
    expect(typeof body.freshness.stale).toBe("boolean");
  });

  test("returns 400 for missing jurisdiction", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/delta?since=2025-01-01");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("returns 400 for missing since", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/delta?jurisdiction=US");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("returns 400 for invalid since date format", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/delta?jurisdiction=US&since=invalid");
    expect(res.status).toBe(400);
  });

  test("returns 400 for lowercase jurisdiction", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/delta?jurisdiction=us&since=2025-01-01");
    expect(res.status).toBe(400);
  });

  test("returns 404 for unknown jurisdiction", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/delta?jurisdiction=XX&since=2025-01-01");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("JURISDICTION_NOT_FOUND");
  });

  test("accepts optional industry parameter", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/delta?jurisdiction=US&since=2025-01-01&industry=finance");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deltas.length).toBeGreaterThan(0);
  });

  test("accepts source_priority=official parameter", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/delta?jurisdiction=US&since=2025-01-01&source_priority=official");
    expect(res.status).toBe(200);
  });

  test("error response validates against error schema", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/delta?since=2025-01-01");
    const body = await res.json();
    const parsed = errorSchema.safeParse(body);
    expect(parsed.success).toBe(true);
  });

  test("deterministic results for same inputs", async () => {
    const app = createApp();
    const res1 = await app.request("/v1/regulations/delta?jurisdiction=US&since=2025-01-01");
    const res2 = await app.request("/v1/regulations/delta?jurisdiction=US&since=2025-01-01");
    const body1 = await res1.json();
    const body2 = await res2.json();
    expect(body1.deltas).toEqual(body2.deltas);
    expect(body1.total_changes).toBe(body2.total_changes);
  });
});

// --- GET /v1/regulations/impact ---

describe("GET /v1/regulations/impact", () => {
  test("returns 200 with valid impact response", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/impact?jurisdiction=US");
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = impactOutputSchema.safeParse(body);
    expect(parsed.success).toBe(true);
  });

  test("response includes jurisdiction from input", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/impact?jurisdiction=GB");
    const body = await res.json();
    expect(body.jurisdiction).toBe("GB");
  });

  test("response total_impacts matches impacts array length", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/impact?jurisdiction=US");
    const body = await res.json();
    expect(body.total_impacts).toBe(body.impacts.length);
  });

  test("returns 400 for missing jurisdiction", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/impact");
    expect(res.status).toBe(400);
  });

  test("returns 404 for unknown jurisdiction", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/impact?jurisdiction=XX");
    expect(res.status).toBe(404);
  });

  test("accepts optional ruleId parameter", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/impact?jurisdiction=US&ruleId=US-REG-001");
    expect(res.status).toBe(200);
  });

  test("accepts optional control_framework parameter", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/impact?jurisdiction=US&control_framework=soc2");
    expect(res.status).toBe(200);
  });

  test("includes freshness in response", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/impact?jurisdiction=US");
    const body = await res.json();
    expect(body.freshness).toBeDefined();
  });

  test("deterministic results for same inputs", async () => {
    const app = createApp();
    const res1 = await app.request("/v1/regulations/impact?jurisdiction=US");
    const res2 = await app.request("/v1/regulations/impact?jurisdiction=US");
    const body1 = await res1.json();
    const body2 = await res2.json();
    expect(body1.impacts).toEqual(body2.impacts);
  });
});

// --- POST /v1/regulations/map-controls ---

describe("POST /v1/regulations/map-controls", () => {
  test("returns 200 with valid map-controls response", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/map-controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ruleId: "US-REG-001",
        control_framework: "soc2",
        jurisdiction: "US",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = mapControlsOutputSchema.safeParse(body);
    expect(parsed.success).toBe(true);
  });

  test("response includes input ruleId", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/map-controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ruleId: "US-REG-001",
        control_framework: "soc2",
        jurisdiction: "US",
      }),
    });
    const body = await res.json();
    expect(body.ruleId).toBe("US-REG-001");
  });

  test("response includes input control_framework", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/map-controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ruleId: "US-REG-001",
        control_framework: "nist",
        jurisdiction: "US",
      }),
    });
    const body = await res.json();
    expect(body.control_framework).toBe("nist");
  });

  test("total_mapped matches mapped_controls length", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/map-controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ruleId: "US-REG-001",
        control_framework: "soc2",
        jurisdiction: "US",
      }),
    });
    const body = await res.json();
    expect(body.total_mapped).toBe(body.mapped_controls.length);
  });

  test("returns 400 for missing ruleId", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/map-controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        control_framework: "soc2",
        jurisdiction: "US",
      }),
    });
    expect(res.status).toBe(400);
  });

  test("returns 400 for missing control_framework", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/map-controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ruleId: "US-REG-001",
        jurisdiction: "US",
      }),
    });
    expect(res.status).toBe(400);
  });

  test("returns 400 for control_framework=all (not allowed in POST)", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/map-controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ruleId: "US-REG-001",
        control_framework: "all",
        jurisdiction: "US",
      }),
    });
    expect(res.status).toBe(400);
  });

  test("returns 404 for unknown jurisdiction", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/map-controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ruleId: "XX-REG-001",
        control_framework: "soc2",
        jurisdiction: "XX",
      }),
    });
    expect(res.status).toBe(404);
  });

  test("includes freshness in response", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/map-controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ruleId: "US-REG-001",
        control_framework: "soc2",
        jurisdiction: "US",
      }),
    });
    const body = await res.json();
    expect(body.freshness).toBeDefined();
    expect(body.freshness.timestamp).toBeDefined();
  });

  test("coverage_score is between 0 and 1", async () => {
    const app = createApp();
    const res = await app.request("/v1/regulations/map-controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ruleId: "US-REG-001",
        control_framework: "soc2",
        jurisdiction: "US",
      }),
    });
    const body = await res.json();
    expect(body.coverage_score).toBeGreaterThanOrEqual(0);
    expect(body.coverage_score).toBeLessThanOrEqual(1);
  });

  test("deterministic results for same inputs", async () => {
    const app = createApp();
    const payload = JSON.stringify({
      ruleId: "US-REG-001",
      control_framework: "soc2",
      jurisdiction: "US",
    });
    const res1 = await app.request("/v1/regulations/map-controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
    const res2 = await app.request("/v1/regulations/map-controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
    const body1 = await res1.json();
    const body2 = await res2.json();
    expect(body1.mapped_controls).toEqual(body2.mapped_controls);
  });
});
